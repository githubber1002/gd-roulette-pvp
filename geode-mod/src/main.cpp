#include <Geode/Geode.hpp>
#include <Geode/modify/PlayLayer.hpp>
#include <Geode/utils/web.hpp>

using namespace geode::prelude;

// Global state for the mod
static bool g_isConnected = false;
static std::string g_currentLevelName = "";
static int g_lastReportedPercent = 0;

// Helper to get the server URL from settings
std::string getServerUrl() {
    auto url = Mod::get()->getSettingValue<std::string>("server-url");
    // Remove trailing slash if present
    if (!url.empty() && url.back() == '/') {
        url.pop_back();
    }
    return url;
}

// Helper to get the connection token from settings
std::string getToken() {
    return Mod::get()->getSettingValue<std::string>("token");
}

// Send a completion/death report to the server
void reportToServer(const std::string& levelName, int percent, bool completed) {
    auto token = getToken();
    if (token.empty()) {
        log::warn("No token set! Cannot report to server.");
        return;
    }

    auto serverUrl = getServerUrl();
    auto url = serverUrl + "/api/mod/report";

    matjson::Value body;
    body["token"] = token;
    body["levelName"] = levelName;
    body["percent"] = percent;
    body["completed"] = completed;

    auto req = web::WebRequest();
    req.bodyJSON(body);
    req.header("Content-Type", "application/json");

    // Fire and forget - we use a static listener to keep it alive
    static std::optional<web::WebTask> s_task;
    s_task = req.post(url);
    s_task->listen(
        [levelName, percent](web::WebResponse* res) {
            if (res->ok()) {
                log::info("Reported: {} at {}%", levelName, percent);
            } else {
                log::error("Report failed ({}): {}", res->code(), res->string().unwrapOr("unknown error"));
            }
        },
        [](auto) {} // progress - ignore
    );
}

// Connect to the server when the token is set
void connectToServer() {
    auto token = getToken();
    if (token.empty()) {
        log::info("No token configured. Skipping connection.");
        return;
    }

    auto serverUrl = getServerUrl();
    auto url = serverUrl + "/api/mod/connect";

    matjson::Value body;
    body["token"] = token;

    auto req = web::WebRequest();
    req.bodyJSON(body);
    req.header("Content-Type", "application/json");

    static std::optional<web::WebTask> s_connectTask;
    s_connectTask = req.post(url);
    s_connectTask->listen(
        [](web::WebResponse* res) {
            if (res->ok()) {
                g_isConnected = true;
                log::info("Connected to Roulette PvP server!");
                Notification::create("Roulette Sync", "Connected to server!", NotificationIcon::Success)->show();
            } else {
                g_isConnected = false;
                log::error("Connection failed ({}): {}", res->code(), res->string().unwrapOr("unknown"));
                Notification::create("Roulette Sync", "Failed to connect. Check your token.", NotificationIcon::Error)->show();
            }
        },
        [](auto) {}
    );
}

// Hook into PlayLayer to detect game events
class $modify(RoulettePlayLayer, PlayLayer) {

    // Called when a level is first loaded or restarted
    bool init(GJGameLevel* level, bool useReplay, bool dontCreateObjects) {
        if (!PlayLayer::init(level, useReplay, dontCreateObjects)) {
            return false;
        }

        // Store the level name for reporting
        g_currentLevelName = std::string(level->m_levelName);
        g_lastReportedPercent = 0;

        log::info("Level loaded: {}", g_currentLevelName);

        // Auto-connect if we have a token but aren't connected yet
        if (!g_isConnected && !getToken().empty()) {
            connectToServer();
        }

        return true;
    }

    // Called when the player dies
    void destroyPlayer(PlayerObject* player, GameObject* obj) {
        // Calculate the current percentage before the death screen
        int currentPercent = this->getCurrentPercentInt();

        log::info("Player died at {}% on {}", currentPercent, g_currentLevelName);

        // Only report if it's higher than our last report (avoid spam on quick restarts)
        if (currentPercent > g_lastReportedPercent && g_isConnected) {
            g_lastReportedPercent = currentPercent;
            reportToServer(g_currentLevelName, currentPercent, false);
        }

        PlayLayer::destroyPlayer(player, obj);
    }

    // Called when the player completes the level (100%)
    void levelComplete() {
        log::info("Level COMPLETE: {}", g_currentLevelName);

        if (g_isConnected) {
            reportToServer(g_currentLevelName, 100, true);
        }

        PlayLayer::levelComplete();
    }

    // Called when the player restarts the level
    void resetLevel() {
        // Reset tracked percent for this attempt
        g_lastReportedPercent = 0;
        PlayLayer::resetLevel();
    }
};

// Mod initialization
$on_mod(Loaded) {
    log::info("Roulette Sync mod loaded!");

    // Try to connect immediately if token is already set
    if (!getToken().empty()) {
        connectToServer();
    }
}
