allprojects {
    repositories {
        google()
        mavenCentral()
    }
    // Force AGP 9.0.1 for all subprojects' buildscript classpath.
    // Prevents NullPointerException in Flutter's getLegacyAndroidExtension
    // when legacy plugins declare an old AGP classpath (e.g. 7.3.0).
    buildscript {
        configurations.all {
            resolutionStrategy {
                force("com.android.tools.build:gradle:9.0.1")
            }
        }
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
