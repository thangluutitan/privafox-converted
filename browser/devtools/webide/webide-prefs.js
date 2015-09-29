# -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

pref("devtools.webide.showProjectEditor", true);
pref("devtools.webide.templatesURL", "http://removed.in.privafox");
pref("devtools.webide.autoinstallADBHelper", true);
pref("devtools.webide.autoinstallFxdtAdapters", true);
pref("devtools.webide.autoConnectRuntime", true);
pref("devtools.webide.restoreLastProject", true);
pref("devtools.webide.enableLocalRuntime", false);
pref("devtools.webide.addonsURL", "http://removed.in.privafox");
pref("devtools.webide.simulatorAddonsURL", "http://removed.in.privafox");
pref("devtools.webide.simulatorAddonID", "fxos_#SLASHED_VERSION#_simulator@mozilla.org");
pref("devtools.webide.simulatorAddonRegExp", "fxos_(.*)_simulator@mozilla\\.org$");
pref("devtools.webide.adbAddonURL", "http://removed.in.privafox");
pref("devtools.webide.adbAddonID", "adbhelper@mozilla.org");
pref("devtools.webide.adaptersAddonURL", "http://removed.in.privafox");
pref("devtools.webide.adaptersAddonID", "http://removed.in.privafox");
pref("devtools.webide.monitorWebSocketURL", "ws://localhost:9000");
pref("devtools.webide.lastConnectedRuntime", "");
pref("devtools.webide.lastSelectedProject", "");
pref("devtools.webide.logSimulatorOutput", false);
pref("devtools.webide.widget.autoinstall", true);
#ifdef MOZ_DEV_EDITION
pref("devtools.webide.widget.enabled", true);
pref("devtools.webide.widget.inNavbarByDefault", true);
#else
pref("devtools.webide.widget.enabled", false);
pref("devtools.webide.widget.inNavbarByDefault", false);
#endif
pref("devtools.webide.zoom", "1");
pref("devtools.webide.busyTimeout", 10000);
pref("devtools.webide.sidebars", false);
