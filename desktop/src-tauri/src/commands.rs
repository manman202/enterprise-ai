use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;

const STORE_PATH: &str = "aiyedun.bin";
const KEY_TOKEN: &str = "auth_token";
const KEY_SERVER_URL: &str = "server_url";

#[tauri::command]
pub async fn save_token(app: AppHandle, token: String) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    store.set(KEY_TOKEN, serde_json::Value::String(token));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_token(app: AppHandle) -> Result<Option<String>, String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    let val = store.get(KEY_TOKEN);
    Ok(val.and_then(|v| v.as_str().map(|s| s.to_string())))
}

#[tauri::command]
pub async fn save_server_url(app: AppHandle, url: String) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    store.set(KEY_SERVER_URL, serde_json::Value::String(url));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_server_url(app: AppHandle) -> Result<Option<String>, String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    let val = store.get(KEY_SERVER_URL);
    Ok(val.and_then(|v| v.as_str().map(|s| s.to_string())))
}

#[tauri::command]
pub async fn clear_auth(app: AppHandle) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    store.delete(KEY_TOKEN);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn show_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
