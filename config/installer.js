var copyright = "developed by sergiodreamswork@gmail.com";

var Path = {
    toUnixSeparator: function (path) {
        if (OS.isWindows())
            return path.replace(/\\/g, '/');
        return path;
    },
    filename: function (path) {
        return path.substring(path.lastIndexOf('/') + 1);
    },
    directory: function (path) {
        return path.substring(0, path.lastIndexOf('/'));
    },
    escape: function (path) {
        return path.replace(/ /g, '%20');
    },
    unescape: function (path) {
        return path.replace(/%20/g, ' ');
    },
    createFile: function (path, text) {
        if (installer.fileExists(path))
            installer.performOperation("Delete", path);
        installer.performOperation("AppendFile", [path, text]);
    },
    removeDir: function (path) {
        if (path && path.length > 0 && installer.fileExists(path)) {
            if (this.isWindows()) {
                Script.execute('rd /s /q ' + Path.escape(path));
            } else {
                installer.performOperation("Execute", ["rm", "-rf", path]);
            }
        }
    }
};

var Shortcut = {
    generateName: function (name) {
        if (OS.isMac()) {
            return OS.programs() + "/" + name + ".app";
        }
        return OS.desktop() + "/" + name + (OS.isWindows() ? ".lnk" : ".desktop");
    },
    create: function (name) {
        var link = this.generateName(name);
        if (installer.fileExists(link)) {
            this.delete(name);
        }
        var file = Path.toUnixSeparator(installer.value("TargetDir")) + "/" + installer.value("MaintenanceToolName");
        if (OS.isWindows()) {
            installer.performOperation("CreateShortcut", [file + ".exe", link]);
        } else if (OS.isMac()) {
            installer.performOperation("Execute", ["ln", "-s", file + ".app", link]);
        } else if (OS.isLinux()) {
            var text = '[Desktop Entry]\n' +
                       'Name=' + installer.value("ProductName") + '\n' +
                       'Exec="' + file + '"\n' +
                       'Icon=' + Program.AppDir + '/game/updater_data/icons/updater_icon_64x64.png\n' +
                       'Terminal=false\n' +
                       'Type=Application';
            Path.createFile(link, text);
            installer.performOperation("Execute", ["chmod", "+x", link]);
        }
    },
    delete: function (name) {
        var link = this.generateName(name);
        installer.performOperation("Delete", link);
    }
};

var Script = {
    execute: function (text) {
        var i, j;
        var command = [];
        text = text.split('\n');
        if (OS.isMac()) {
            for (i = 0; i < text.length; i++) {
                command.push("-e");
                command.push(text[i]);
            }
            installer.executeDetached("osascript", command);
        }
        else if (OS.isWindows()) {
            var cmd = installer.environmentVariable("ComSpec");
            command.push(cmd, "/c");
            for (i = 0; i < text.length; i++) {
                var line = text[i].split(' ');
                for (j = 0; j < line.length; j++) {
                    command.push(Path.unescape(line[j]));
                }
                if (i < text.length - 1)
                    command.push("&&");
            }
            installer.performOperation("Execute", command);
        }
    }
};

var OS = {
    arch: "",
    kernel: "",
    kernelVer: "",
    name: "",
    type: "",
    ver: "",
    getInfo: function () {
        this.arch = systemInfo.currentCpuArchitecture;
        this.kernel = systemInfo.kernelType;
        this.kernelVer = systemInfo.kernelVersion;
        this.name = systemInfo.prettyProductName;
        this.type = systemInfo.productType;
        this.ver = systemInfo.productVersion;
    },
    home: function () {
        return Path.toUnixSeparator(installer.value("HomeDir"));
    },
    desktop: function () {
        if (this.isWindows()) {
            return Path.toUnixSeparator(installer.value("DesktopDir"));
        } else {
            return this.home() + "/Desktop";
        }
    },
    programs: function () {
        return Path.toUnixSeparator(installer.value("ApplicationsDir"));
    },
    installerDir: function () {
        return Path.toUnixSeparator(installer.value("InstallerDirPath"));
    },
    killProcess: function (name) {
        if (this.isWindows()) {
            installer.performOperation("Execute", ["taskkill", "/im", name + ".exe", "/f", "/t"]);
        } else {
            installer.performOperation("Execute", ["killall", name]);
        }
    },
    majorVersion: function () {
        return parseInt(this.kernelVer.split(".", 1));
    },
    isWindows: function () {
        return this.kernel === "winnt";
    },
    isMac: function () {
        return this.kernel === "darwin";
    },
    isLinux: function () {
        return this.kernel === "linux";
    },
    is64: function () {
        return this.arch === "x86_64";
    },
    isSupported: function () {
        if (this.isWindows()) {
            if (this.majorVersion() >= 5) // min: Windows XP (NT 5.1)
                return true;
        } else if (this.isMac()) {
            if (this.majorVersion() >= 11) // min: Mac OS X Lion (10.7)
                return true;
        } else if (this.isLinux()) {
            return true;
        }
        return false;
    }
};

var Registry = {
    query: function (key, value, recursively) {
        var keys = [];
        if (key && OS.isWindows()) {
            var command = ["query", key];
            if (value !== undefined && value) command.push("/v", value);
            if (recursively !== undefined && recursively) command.push("/s");
            if (OS.is64()) command.push("/reg:64");
            var result = installer.execute("reg", command);
            if (result && result.length === 2 && result[1] === 0) {
                var lines = result[0].trim().split(/\n+/);
                if (lines.length > 1) {
                    var j = -1;
                    for (var i = 0; i < lines.length; i++) {
                        if (/^\s+/m.test(lines[i])) {
                            var line = lines[i].trim().split(/\s{2,}/);
                            if (line.length === 3) {
                                if (keys[j].values !== undefined)
                                    keys[j].values.push({name: line[0], type: line[1], data: line[2]});
                            }
                        } else {
                            if (lines[i].indexOf("HK") === 0) {
                                j++;
                                keys[j] = {key: lines[i].trim(), values: []};
                            }
                        }
                    }
                }
            }
        }
        return keys;
    },
    delete: function (key, value) {
        if (key !== undefined && key && OS.isWindows()) {
            var command = ["delete", key];
            if (value !== undefined && value) command.push("/v", value);
            command.push("/f");
            var result = installer.execute("reg", command);
            if (result && result.length === 2)
                return !result[1];
        }
        return false;
    },
    getValue: function (key, value) {
        var result = this.query(key, value, false);
        if (result && result.length === 1) {
            if (result[0].values !== undefined && result[0].values && result[0].values.length === 1) {
                if (result[0].values[0].data !== undefined && result[0].values[0].data)
                    return result[0].values[0].data;
            }
        }
        return null;
    },
    getValues: function (key, value) {
        var values = [];
        var result = this.query(key, value, true);
        if (result && result.length > 0) {
            for (var i = 0; i < result.length; i++) {
                if (result[i].values !== undefined && result[i].values && result[i].values.length === 1) {
                    if (result[i].values[0].data !== undefined && result[i].values[0].data) {
                        values.push({key: result[i].key, data: result[i].values[0].data});
                    }
                }
            }
        }
        return values;
    },
    getKeys: function (key) {
        var keys = [];
        var length = key.split('\\').length;
        var result = this.query(key, '', false);
        if (result && result.length > 0) {
            for (var i = 0; i < result.length; i++) {
                var subkey = result[i].key.split('\\');
                if (subkey.length !== length)
                    keys.push(subkey.pop());
            }
        }
        return keys;
    },
    getSID: function () {
        var sids = this.getValues("HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList", "State");
        for (var i = 0; i < sids.length; i++) {
            if (parseInt(sids[i].data) !== 0 && parseInt(this.getValue(sids[i].key, "RefCount")) !== 0)
                return sids[i].key.substring(sids[i].key.lastIndexOf('\\') + 1);
        }
        return null;
    },
    findSteamApp: function (id) {
        var installed = this.getValue("HKCU\\Software\\Valve\\Steam\\Apps\\" + id, "Installed");
        if (installed && parseInt(installed) === 1) {
            return this.getValue("HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App " + id, "InstallLocation");
        }
        return null;
    },
    findUninstallKey: function (key, name) {
        var apps = this.getValues(key, "DisplayName");
        for (var i = 0; i < apps.length; i++) {
            if (apps[i].data === name)
                return {key: apps[i].key, location: this.getValue(apps[i].key, "InstallLocation")};
        }
        return null;
    },
    findInstalledProgram: function (name) {
        var SID = this.getSID();
        var appKey, uninstallKey = "\\Microsoft\\Windows\\CurrentVersion\\Uninstall";
        if (SID) appKey = this.findUninstallKey("HKU\\" + SID + "\\Software" + uninstallKey, name);
        if (!appKey) appKey = this.findUninstallKey("HKLM\\Software" + uninstallKey, name);
        if (!appKey && OS.is64()) appKey = this.findUninstallKey("HKLM\\Software\\Wow6432Node" + uninstallKey, name);
        return appKey;
    }
};

var Program = {
    App: "",
    AppDir: "",
    GameDir: "",
    Updater: "",
    UpdaterPath: "",
    Name: "",
    Steam: false,
    SteamAppID: 0,
    Plugins: "",
    Mods: "",
    setApp: function (name, id) {
        this.Name = name;
        this.SteamAppID = id;
        if (OS.isWindows()) {
            this.App = this.Name + ".exe";
            this.Updater = "transition.exe";
        } else if (OS.isMac()) {
            this.App = this.Name + ".app";
            this.Updater = "Updater " + this.App;
        } else if (OS.isLinux()) {
            this.App = this.Name;
            this.Updater = "transition";
        }
    },
    isWakfuDir: function (dir) {
        if (dir !== undefined && dir && dir.length > 0 && installer.fileExists(dir)) {
            var updaterPath, gameDir, appDir = Path.toUnixSeparator(dir);
            if (OS.isMac()) {
                gameDir = appDir + "/Wakfu.app/Contents/Resources";
                if (!installer.fileExists(gameDir))
                    gameDir = appDir + "/game";
                updaterPath = appDir + "/" + this.Updater + "/Contents/MacOS/transition";
            }
            else {
                gameDir = appDir + "/game";
                updaterPath = appDir + "/transition/" + this.Updater;
            }
            if (installer.fileExists(updaterPath) && installer.fileExists(gameDir)) {
                this.AppDir = appDir;
                this.GameDir = gameDir;
                this.UpdaterPath = updaterPath;
                return true;
            }
        }
        return false;
    },
    findWakfuSteam: function () {
        var steamApp, appDir;
        if (OS.isWindows()) {
            steamApp = OS.programs() + "/Steam/Steam.exe";
        } else if (OS.isMac()) {
            steamApp = OS.programs() + "/Steam.app";
        } else if (OS.isLinux()) {
            steamApp = "/usr/bin/steam";
        }
        if (installer.fileExists(steamApp)) {
            if (OS.isWindows()) {
                appDir = OS.programs() + "/Steam/steamapps/common/" + this.Name;
                if (!installer.fileExists(appDir)) {
                    appDir = Path.toUnixSeparator(Registry.findSteamApp(this.SteamAppID));
                }
            } else if (OS.isMac()) {
                appDir = OS.home() + "/Library/Application Support/Steam/steamapps/common/" + this.Name;
            } else if (OS.isLinux()) {
                appDir = OS.home() + "/.local/share/Steam/steamapps/common/" + this.Name;
            }
        }
        return this.isWakfuDir(appDir);
    },
    findWakfu: function() {
        var appDir;
        this.Steam = this.findWakfuSteam();
        if (this.Steam) return true;
        if (OS.isMac()) {
            appDir = OS.programs() + "/" + this.App + "/Contents/Data";
        } else {
            var paths = [
                OS.programs() + "/" + this.Name,
                OS.programs() + "/Ankama/" + this.Name,
                OS.desktop() + "/" + this.Name,
                OS.home() + "/" + this.Name,
                OS.installerDir()
            ];
            if (OS.isWindows() && OS.is64()) {
                paths.push(OS.programs().replace(" (x86)", '') + "/" + this.Name);
            }
            var path = installer.findPath(this.App, paths);
            if (path) {
                appDir = Path.directory(path);
            }
            else if (OS.isWindows()) {
                var appKey = Registry.findInstalledProgram(this.Name);
                if (appKey !== undefined && appKey)
                    appDir = Path.toUnixSeparator(appKey.location);
            }
        }
        return this.isWakfuDir(appDir);
    },
    setWakfuDirs: function(appDir) {
        if (appDir && appDir.length > 0) {
            if (OS.isMac()) {
                this.Plugins = appDir + "/" + this.Updater + "/Contents/PlugIns/updater";
                this.Mods = this.Steam ? appDir + "/game/mods" : appDir + "/" + this.App + "/Contents/Resources/mods";
            } else {
                this.Plugins = appDir + "/transition/plugins/updater";
                this.Mods = appDir + "/game/mods";
            }
            installer.setValue("WAKFU_PLUGINS", this.Plugins);
            installer.setValue("WAKFU_MODS", this.Mods);
        }
    },
    run: function () {
        if (this.Steam) {
            if (OS.isWindows()) {
                Script.execute('start steam://rungameid/' + this.SteamAppID);
            } else if (OS.isMac()) {
                installer.performOperation("Execute", ["open", "steam://run/" + this.SteamAppID]);
            } else if (OS.isLinux()) {
                installer.performOperation("Execute", ["steam", "steam://rungameid/" + this.SteamAppID]);
            }
        } else {
            installer.executeDetached(this.UpdaterPath);
        }
    }
};

function setButtonText(widget, button, text) {
    var child = widget.findChild(button);
    child.text = text;
}

function setFont(text, color) {
    return "<span style='color: " + color + "'>" + text + "</span>";
}

function Controller()
{
    OS.getInfo();
    Program.setApp("Wakfu", 215080);

    if (OS.isMac()) {
        Script.execute('tell application "Finder" to close window "' + installer.value("ProductName") + '"');
    }

    if (!OS.isSupported()) {
        QMessageBox.warning("", installer.value("ProductName"), "Your operating system is not supported!");
    }

    installer.finishButtonClicked.connect(this, onFinishButtonClicked);
    installer.installationStarted.connect(this, onInstallationStarted);
    installer.installationFinished.connect(this, onInstallationFinished);
    installer.uninstallationStarted.connect(this, onUninstallationStarted);
    installer.uninstallationFinished.connect(this, onUninstallationFinished);

    installer.setDefaultPageVisible(QInstaller.LicenseCheck, false);
    installer.setDefaultPageVisible(QInstaller.StartMenuSelection, false);
    installer.setMessageBoxAutomaticAnswer("OverwriteTargetDirectory", QMessageBox.Yes);

    if (installer.isUninstaller()) {
        installer.setValue("RemoveTargetDir", true);
    }
}

Controller.prototype.IntroductionPageCallback = function()
{
    var page = gui.currentPageWidget();
    if (page != null) {
        page.title = "<p style='font-size: 14px;" +
                               "font-weight: normal;" +
                               "font-style: italic;" +
                                (OS.isMac() ? "text-align: right;" : "") +
                               "font-variant: small-caps;'>" + copyright + " </p>";

        if (installer.isInstaller()) {
            var supported = OS.isSupported() ? setFont("SUPPORTED", "green") : setFont("NOT SUPPORTED", "red");

            var found = Program.findWakfu() ? setFont(Program.AppDir, "blue") :
                                              "Please select the location of " + setFont(Program.Name, "blue") + " on the next step!";

            page.MessageLabel.setText("<p><b>" + Program.Name + ":</b> " + found + "</p>" +
                                      "<p><b>OS:</b> " + OS.name + " " + OS.arch + " [" + supported + "]</p>");
        }
        else if (installer.isUninstaller()) {
            page.MessageLabel.setText("The tool just helps to add new mods, update or remove existing mods.\n" +
                                      "Also you can completely delete the the program and all mods.");

            setButtonText(page, "PackageManagerRadioButton", "Install or remove mods");
            setButtonText(page, "UpdaterRadioButton", "Update mods");
            setButtonText(page, "UninstallerRadioButton", "Uninstall the program");

            var appDir = Path.directory(installer.value("TargetDir"));
            if (Program.isWakfuDir(appDir)) {
                Program.setWakfuDirs(appDir);
            }
            else {
                QMessageBox.error("", installer.value("ProductName"), "The " + Program.Name + " directory does not exist!");
                page.findChild("PackageManagerRadioButton").visible = false;
                page.findChild("UpdaterRadioButton").visible = false;
            }
        }
    }
};

Controller.prototype.TargetDirectoryPageCallback = function()
{
    if (!Program.AppDir) {
        var appDir;
        if (OS.isMac()) {
            var path = QFileDialog.getOpenFileName("Please select " + Program.App + " or " + Program.Updater,
                                                    OS.programs(), "Applications (*" + Program.App + ")");
            if (path) {
                var app = Path.filename(path);
                if (app === Program.Updater)
                    appDir = Path.directory(path);
                else if (app === Program.App)
                    appDir = path + "/Contents/Data";
            }
        }
        else {
            appDir = QFileDialog.getExistingDirectory("Please select " + Program.Name + " folder", OS.programs());
        }
        if (!Program.isWakfuDir(appDir)) {
            var result = QMessageBox.question("quit.question", installer.value("ProductName"),
                                              "It is not the correct location of " + Program.Name + "!\n" +
                                              "Do you want to quit the installer?",
                                              QMessageBox.Yes | QMessageBox.No, QMessageBox.No);

            if (result === QMessageBox.Yes) {
                gui.rejectWithoutPrompt();
            }
            else {
                gui.clickButton(buttons.BackButton);
            }
        }
    }
    var targetDir = Program.AppDir + "/" + installer.value("ProductName");
    var page = gui.pageWidgetByObjectName("TargetDirectoryPage");
    page.TargetDirectoryLineEdit.setText(targetDir);
    Program.setWakfuDirs(Program.AppDir);
    gui.clickButton(buttons.NextButton);
};

Controller.prototype.ComponentSelectionPageCallback = function() {};
Controller.prototype.LicenseAgreementPageCallback = function() {};
Controller.prototype.StartMenuDirectoryPageCallback = function() {};

Controller.prototype.ReadyForInstallationPageCallback = function()
{
    if (installer.isProcessRunning("transition")) {
        var result = QMessageBox.question("terminate.question", installer.value("ProductName"),
                                          "Updater Wakfu is running!\n" +
                                          "It is recommended to correctly quit the program.\n" +
                                          "Or do you want to terminate it?",
                                          QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes);

        if (result === QMessageBox.Yes) {
            OS.killProcess("transition");
        }
    }
    gui.clickButton(buttons.CommitButton);
};

Controller.prototype.PerformInstallationPageCallback = function() {};

Controller.prototype.FinishedPageCallback = function()
{
    var page = gui.currentPageWidget();
    if (page != null) {
        if (installer.isInstaller()) {
            if (installer.status === QInstaller.Success) {
                page.title = "The installation is completed.";
                page.MessageLabel.visible = false;
                page.RunItCheckBox.visible = true;
                page.RunItCheckBox.checked = true;
                page.RunItCheckBox.text = "Run " + Program.Name + " now.";
            }
        }
        else if (installer.isUninstaller()) {
            if (OS.isWindows()) {
                gui.clickButton(buttons.FinishButton);
            }
            else {
                page.title = "The uninstallation process is completed.";
                page.MessageLabel.setText("All components have been deleted!");
            }
        }
        else if (installer.isUpdater()) {
            page.title = "The updating process is completed.";
            page.MessageLabel.setText("All components have been updated!");
        }
        else if (installer.isPackageManager()) {
            page.title = "The configuration process is completed.";
            page.MessageLabel.setText("All operations have been done!");
        }
    }
};

onFinishButtonClicked = function () {
    if (installer.isInstaller()) {
        var page = gui.pageWidgetByObjectName("FinishedPage");
        if (page != null) {
            if (page.RunItCheckBox.checked) {
                Program.run();
            }
        }
        if (OS.isMac()) {
            Script.execute(
                'tell application "System Events"\n' +
                'repeat while process "' + installer.value("ProductName") + '" exists\n' +
                'delay 1\n' +
                'end repeat\n' +
                'tell application "Finder" to eject disk "' + installer.value("ProductName") + '"\n' +
                'end tell'
            );
        }
    }
    else if (installer.isUninstaller()) {
        if (OS.isWindows()) {
            QMessageBox.information("", installer.value("ProductName"), "The uninstallation process is completed.");
        }
    }
    gui.rejectWithoutPrompt();
};

onInstallationStarted = function () {
    if (installer.isInstaller()) {
        if (OS.isWindows()) {
            var appKey = Registry.findInstalledProgram(installer.value("ProductName"));
            if (appKey !== undefined && appKey)
                Registry.delete(appKey.key);
        }
    }
};

onInstallationFinished = function () {
    if (installer.isInstaller()) {
        if (installer.status === QInstaller.Success) {
            Shortcut.create(installer.value("ProductName"));
        }
    }
};

onUninstallationStarted = function () {
    if (installer.isUninstaller()) {
        Shortcut.delete(installer.value("ProductName"));
    }
};

onUninstallationFinished = function () {
    if (installer.isUninstaller()) {
        Path.removeDir(Program.Mods);
        if (OS.isWindows()) {
            var installerUpdater = installer.value("TargetDir") + "/" + installer.value("MaintenanceToolName") + ".exe";
            installer.performOperation("Delete", installerUpdater);
            Script.execute(
                'cd ' + Path.escape(Program.AppDir) + '\n' +
                'taskkill /im ' + installer.value("MaintenanceToolName") + '.exe /f\n' +
                'ping -n 2 127.0.0.1\n' +
                'rd /s /q ' + Path.escape(installer.value("TargetDir"))
            );
        }
    }
};