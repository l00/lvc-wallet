use serde_json::{json, Value};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, State};

#[derive(Default)]
struct Walletd {
    child: Mutex<Option<Child>>,
    log: Arc<Mutex<Vec<String>>>,
}

#[tauri::command]
async fn rpc_request(url: String, method: String, params: Value) -> Result<Value, String> {
    let endpoint = build_json_rpc_url(&url);

    let body = json!({
        "jsonrpc": "2.0",
        "id": "0",
        "method": method,
        "params": params,
    });

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("failed to build http client: {e}"))?;

    let resp = client
        .post(&endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("could not reach walletd at {endpoint}: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("walletd returned HTTP {}", resp.status()));
    }

    let payload: Value = resp
        .json()
        .await
        .map_err(|e| format!("invalid JSON from walletd: {e}"))?;

    if let Some(err) = payload.get("error") {
        if !err.is_null() {
            let message = err
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("unknown RPC error");
            return Err(message.to_string());
        }
    }

    Ok(payload.get("result").cloned().unwrap_or(Value::Null))
}

fn build_json_rpc_url(url: &str) -> String {
    let trimmed = url.trim().trim_end_matches('/');
    let with_scheme = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    };

    if with_scheme.ends_with("/json_rpc") {
        with_scheme
    } else {
        format!("{with_scheme}/json_rpc")
    }
}

#[tauri::command]
fn default_wallet_dir() -> String {
    let base = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    format!("{base}/.levcoin/wallets")
}

#[tauri::command]
fn list_wallets(dir: String) -> Result<Vec<String>, String> {
    const SKIP_EXT: &[&str] = &["log", "txt", "dat", "bin", "json", "keys", "address"];
    let path = std::path::Path::new(&dir);
    std::fs::create_dir_all(path).ok();
    if !path.is_dir() {
        return Ok(vec![]);
    }

    let mut out = Vec::new();
    for entry in std::fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if !p.is_file() {
            continue;
        }
        let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("");
        if SKIP_EXT.contains(&ext) {
            continue;
        }
        if let Some(name) = p.file_name().and_then(|s| s.to_str()) {
            out.push(name.to_string());
        }
    }
    out.sort();
    Ok(out)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartArgs {
    bin: String,
    container: String,
    password: String,
    daemon_address: String,
    bind_port: u16,
    #[serde(default)]
    lib_path: Option<String>,
}

fn base_command(bin: &Path, args: &StartArgs) -> std::process::Command {
    let mut cmd = std::process::Command::new(bin);
    apply_library_path(&mut cmd, bin, args.lib_path.as_deref());
    suppress_console_window(&mut cmd);
    cmd.arg("-w")
        .arg(&args.container)
        .arg("-p")
        .arg(&args.password);
    cmd
}

#[cfg(windows)]
fn suppress_console_window(cmd: &mut std::process::Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn suppress_console_window(_cmd: &mut std::process::Command) {}

fn resolve_walletd(app: &AppHandle, args: &StartArgs) -> Result<PathBuf, String> {
    let explicit = args.bin.trim();
    if !explicit.is_empty() {
        return Ok(PathBuf::from(explicit));
    }
    let name = if cfg!(windows) { "walletd.exe" } else { "walletd" };
    let bin = app
        .path()
        .resolve(format!("resources/walletd/bin/{name}"), BaseDirectory::Resource)
        .map_err(|e| format!("could not locate bundled walletd: {e}"))?;
    // packaging may not preserve the executable bit, so restore it before use
    ensure_executable(&bin);
    Ok(bin)
}

#[cfg(unix)]
fn ensure_executable(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    if let Ok(meta) = std::fs::metadata(path) {
        let mut perms = meta.permissions();
        if perms.mode() & 0o111 == 0 {
            perms.set_mode(0o755);
            let _ = std::fs::set_permissions(path, perms);
        }
    }
}

#[cfg(not(unix))]
fn ensure_executable(_path: &Path) {}

fn apply_library_path(cmd: &mut std::process::Command, bin: &Path, explicit: Option<&str>) {
    let var = if cfg!(target_os = "macos") {
        "DYLD_LIBRARY_PATH"
    } else if cfg!(unix) {
        "LD_LIBRARY_PATH"
    } else {
        return;
    };

    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(p) = explicit {
        if !p.is_empty() {
            dirs.push(PathBuf::from(p));
        }
    }
    // only lib-boost, deliberately not lib: that dir ships an ancient libc/ld-linux
    // that conflicts with a modern system glibc and makes walletd fail to start
    if let Some(root) = bin.parent().and_then(|d| d.parent()) {
        dirs.push(root.join("lib-boost"));
    }
    if let Ok(existing) = std::env::var(var) {
        if !existing.is_empty() {
            dirs.push(PathBuf::from(existing));
        }
    }
    if let Ok(joined) = std::env::join_paths(dirs) {
        cmd.env(var, joined);
    }
}

fn add_daemon(cmd: &mut std::process::Command, daemon_address: &str) {
    let da = daemon_address.trim();
    if let Some((host, port)) = da.rsplit_once(':') {
        cmd.arg("--daemon-address").arg(host).arg("--daemon-port").arg(port);
    } else if !da.is_empty() {
        cmd.arg("--daemon-address").arg(da);
    }
}

#[tauri::command]
fn generate_wallet(app: AppHandle, args: StartArgs) -> Result<(), String> {
    let bin = resolve_walletd(&app, &args)?;
    let mut cmd = base_command(&bin, &args);
    cmd.arg("-g");
    let out = cmd
        .output()
        .map_err(|e| format!("failed to launch walletd ('{}'): {e}", bin.display()))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        let stdout = String::from_utf8_lossy(&out.stdout);
        let detail = stderr
            .lines()
            .chain(stdout.lines())
            .rev()
            .find(|l| !l.trim().is_empty())
            .unwrap_or("walletd exited with an error");
        return Err(format!("could not create wallet: {detail}"));
    }
    Ok(())
}

#[tauri::command]
fn start_walletd(app: AppHandle, args: StartArgs, state: State<Walletd>) -> Result<(), String> {
    stop_child(&state)?;
    if let Ok(mut log) = state.log.lock() {
        log.clear();
    }

    let bin = resolve_walletd(&app, &args)?;
    let mut cmd = base_command(&bin, &args);
    cmd.arg("--bind-port").arg(args.bind_port.to_string());
    add_daemon(&mut cmd, &args.daemon_address);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("failed to launch walletd ('{}'): {e}", bin.display()))?;

    // unread pipes eventually fill and block walletd, so drain them on background threads
    for stream in [
        child.stdout.take().map(drainable),
        child.stderr.take().map(drainable),
    ]
    .into_iter()
    .flatten()
    {
        let log = state.log.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stream).lines().map_while(Result::ok) {
                if let Ok(mut log) = log.lock() {
                    log.push(line);
                    if log.len() > 200 {
                        log.remove(0);
                    }
                }
            }
        });
    }

    let mut guard = state.child.lock().map_err(|_| "walletd state poisoned".to_string())?;
    *guard = Some(child);
    Ok(())
}

fn drainable<R: std::io::Read + Send + 'static>(r: R) -> Box<dyn std::io::Read + Send> {
    Box::new(r)
}

#[tauri::command]
fn walletd_failed(state: State<Walletd>) -> Result<Option<String>, String> {
    let mut guard = state.child.lock().map_err(|_| "walletd state poisoned".to_string())?;
    let exited = match guard.as_mut() {
        Some(child) => matches!(child.try_wait(), Ok(Some(_))),
        None => false,
    };
    if !exited {
        return Ok(None);
    }
    let detail = state
        .log
        .lock()
        .ok()
        .and_then(|log| log.iter().rev().find(|l| !l.trim().is_empty()).cloned())
        .unwrap_or_else(|| "walletd exited unexpectedly".to_string());
    Ok(Some(detail))
}

#[tauri::command]
fn stop_walletd(state: State<Walletd>) -> Result<(), String> {
    stop_child(&state)
}

fn stop_child(state: &State<Walletd>) -> Result<(), String> {
    let mut guard = state.child.lock().map_err(|_| "walletd state poisoned".to_string())?;
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Walletd::default())
        .invoke_handler(tauri::generate_handler![
            rpc_request,
            default_wallet_dir,
            list_wallets,
            generate_wallet,
            start_walletd,
            walletd_failed,
            stop_walletd
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app_handle.try_state::<Walletd>() {
                    if let Ok(mut guard) = state.child.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
