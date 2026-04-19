#include <Geode/Geode.hpp>
#include <Geode/modify/PlayLayer.hpp>
#include <Geode/utils/web.hpp>

using namespace geode::prelude;

// Global state for the mod
static bool g_isConnected = false;
static std::string g_currentLevelName = "";
static int g_currentLevelID = 0;
static int g_lastReportedPercent = 0;

// Helper to get the server URL from settings
std::string getServerUrl() {
    auto url = Mod::get()->getSettingValue<std::string>("server-url");
    
    // Basic cleaning: remove spaces and tabs
    url.erase(std::remove_if(url.begin(), url.end(), [](unsigned char c) {
        return std::isspace(c);
    }), url.end());

    // Ensure it starts with http
    if (!url.empty() && url.find("http") != 0) {
        url = "https://" + url;
    }

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

#include <thread>

// Send a completion/death report to the server
void reportToServer(const std::string& levelName, int levelId, int percent, bool completed) {
    auto token = getToken();
    if (token.empty()) {
        log::warn("No token set! Cannot report to server.");
        return;
    }

    auto serverUrl = getServerUrl();
    auto urlStr = serverUrl + "/api/mod/report";
    log::info("Reporting to: {}", urlStr);
    std::string tokenStr = token;
    std::string levelStr = levelName;

    std::thread([urlStr, tokenStr, levelStr, levelId, percent, completed]() {
        auto req = web::WebRequest();
        req.header("Content-Type", "application/json");

        matjson::Value body;
        body["token"] = tokenStr;
        body["levelName"] = levelStr;
        body["levelId"] = levelId;
        body["percent"] = percent;
        body["completed"] = completed;
        req.bodyJSON(body);

        auto res = req.postSync(urlStr);
        bool ok = res.ok();
        int code = res.code();
        std::string errStr = res.string().unwrapOr("unknown error");

        geode::Loader::get()->queueInMainThread([ok, code, errStr, levelStr, percent]() {
            if (ok) {
                log::info("Reported: {} at {}%", levelStr, percent);
            } else {
                log::error("Report failed ({}): {}", code, errStr);
            }
        });
    }).detach();
}

// Connect to the server when the token is set
void connectToServer() {
    auto token = getToken();
    if (token.empty()) {
        log::info("No token configured. Skipping connection.");
        return;
    }

    auto serverUrl = getServerUrl();
    auto urlStr = serverUrl + "/api/mod/connect";
    log::info("Connecting to: {} with token: {}", urlStr, token);
    std::string tokenStr = token;

    std::thread([urlStr, tokenStr]() {
        auto req = web::WebRequest();
        req.header("Content-Type", "application/json");

        matjson::Value body;
        body["token"] = tokenStr;
        req.bodyJSON(body);

        auto res = req.postSync(urlStr);
        bool ok = res.ok();
        int code = res.code();
        std::string errStr = res.string().unwrapOr("unknown");

        geode::Loader::get()->queueInMainThread([ok, code, errStr, urlStr]() {
            if (ok) {
                g_isConnected = true;
                log::info("Connected to Roulette PvP server!");
                Notification::create("Connected to Roulette Sync!", NotificationIcon::Success)->show();
            } else {
                g_isConnected = false;
                std::string curlErr = errStr;
                log::error("Connection failed ({}): {}", code, curlErr);
                log::error("System hit URL: {}", urlStr);
                
                std::string msg = "Connect failed (" + std::to_string(code) + ")";
                if (!curlErr.empty()) msg += ": " + curlErr;
                
                Notification::create(msg, NotificationIcon::Error)->show();
            }
        });
    }).detach();
}

// Hook into PlayLayer to detect game events
class $modify(RoulettePlayLayer, PlayLayer) {

    // Called when a level is first loaded or restarted
    bool init(GJGameLevel* level, bool useReplay, bool dontCreateObjects) {
        if (!PlayLayer::init(level, useReplay, dontCreateObjects)) {
            return false;
        }

        // Store the level info for reporting
        g_currentLevelName = std::string(level->m_levelName);
        g_currentLevelID = level->m_levelID;
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
            reportToServer(g_currentLevelName, g_currentLevelID, currentPercent, false);
        }

        PlayLayer::destroyPlayer(player, obj);
    }

    // Called when the player completes the level (100%)
    void levelComplete() {
        log::info("Level COMPLETE: {}", g_currentLevelName);

        if (g_isConnected) {
            reportToServer(g_currentLevelName, g_currentLevelID, 100, true);
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

    // Listens for setting changes to reconnect immediately
    listenForSettingChanges<std::string>("token", [](std::string value) {
        connectToServer();
    });
    listenForSettingChanges<std::string>("server-url", [](std::string value) {
        connectToServer();
    });

    // Try to connect immediately if token is already set
    if (!getToken().empty()) {
        connectToServer();
    }
}
