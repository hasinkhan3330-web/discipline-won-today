# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep line numbers for readable crash reports in Play Console.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- Capacitor / WebView bridge ---------------------------------------------
# Capacitor uses reflection + @JavascriptInterface to expose plugins to the
# WebView, so plugin classes and their members must survive R8.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- Cordova plugins bridged through Capacitor ------------------------------
-keep class org.apache.cordova.** { *; }

# --- RevenueCat (Google Play Billing) ---------------------------------------
-keep class com.revenuecat.purchases.** { *; }
-keep class com.android.billingclient.** { *; }
-dontwarn com.revenuecat.purchases.**

# Suppress noisy warnings from optional deps
-dontwarn javax.annotation.**
-dontwarn org.jetbrains.annotations.**
