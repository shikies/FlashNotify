#!/bin/sh
# Gradle start up script for UN*X

APP_HOME="$(cd "$(dirname "$0")" && pwd)"
JAVA_EXE="java"

# Determine the Java command to use
if [ -n "$JAVA_HOME" ]; then
    JAVA_EXE="$JAVA_HOME/bin/java"
fi

exec "$JAVA_EXE" \
    -classpath "$APP_HOME/gradle/wrapper/gradle-wrapper.jar" \
    org.gradle.wrapper.GradleWrapperMain "$@"
