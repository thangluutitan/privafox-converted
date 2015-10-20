/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.preferences;

import java.util.HashSet;
import java.util.Set;

import org.mozilla.gecko.GeckoSharedPrefs;
import org.mozilla.gecko.util.PrefUtils;

import android.content.Context;
import android.content.SharedPreferences;
import android.preference.Preference;

public class ClearOnShutdownPref implements GeckoPreferences.PrefHandler {
    public static final String PREF = GeckoPreferences.NON_PREF_PREFIX + "history.clear_on_exit";
    public static final String PREF_DEFAULT_ENABLE = PREF + ".enable";
    @Override
    public boolean setupPref(Context context, Preference pref) {
        // The pref is initialized asynchronously. Read the pref explicitly
        // here to make sure we have the data.
        final SharedPreferences prefs = GeckoSharedPrefs.forProfile(context);
        /*
        * Privafox MBT-25 :
         */
        int enableDefault = prefs.getInt(PREF_DEFAULT_ENABLE, 0);
        if(enableDefault == 0){
            final SharedPreferences.Editor editor = prefs.edit();
            editor.putInt(PREF_DEFAULT_ENABLE, 1);
            editor.commit();
            Set<String> dataPut = new HashSet<String>();
            dataPut.add("private.data.cookies_sessions");
            dataPut.add("private.data.offlineApps");
            dataPut.add("private.data.siteSettings");
            final SharedPreferences.Editor editorStartup = prefs.edit();
            PrefUtils.putStringSet(editorStartup, PREF, dataPut);
            editorStartup.apply();
        }
        final Set<String> clearItems = PrefUtils.getStringSet(prefs, PREF, new HashSet<String>());
        ((ListCheckboxPreference) pref).setChecked(clearItems.size() > 0);
        return true;
    }

    @Override
    @SuppressWarnings("unchecked")
    public void onChange(Context context, Preference pref, Object newValue) {
        final Set<String> vals = (Set<String>) newValue;
        ((ListCheckboxPreference) pref).setChecked(vals.size() > 0);
    }
}
