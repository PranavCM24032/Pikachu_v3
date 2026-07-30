# 📱 Pykachu Android Security Wrapper

To implement **OS-Level Screenshot Blocking**, you must wrap your website into a Native Android App. This folder contains the source code for that wrapper.

## How to build your Secured APK:

### 1. Requirements
* Install [Android Studio](https://developer.android.com/studio).
* Create a New Project with an **"Empty Activity"**.
* Name the package: `com.pykachu.hunt`.

### 2. Implementation
1. **Copy `MainActivity.java`**: Overwrite the `MainActivity.java` in your new project with the version in this folder.
2. **Copy Layout**: Place `activity_main.xml` into the `res/layout/` folder of your project.
3. **Copy Manifest**: Update your `AndroidManifest.xml` with the one provided here.
4. **The Web Assets**:
   * Create an `assets` folder in your Android Studio project (`app/src/main/assets`).
   * Copy **all your web project files** (player.html, style.css, player.js, puzzle.json, and images folder) into this `assets` folder.

### 3. Build
* In Android Studio, go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
* Install the resulting APK on your phone.

---

## 🛡️ What this Wrapper Blocks:
1. **System Screenshots**: Power + Volume combinations will fail.
2. **Screen Recording**: OBS, Mobizen, or system recorders will only see a BLACK screen.
3. **App Switching**: When you switch apps, the "preview" card of your app will be completely black, preventing capture from the task manager.
4. **Google Assistant**: "Ok Google, take a screenshot" will fail.

**Note:** This is the most professional way to protect sensitive data on Android used by banking and streaming apps (like Netflix).
