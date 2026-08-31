plugins {
	id("java")
	id("org.jetbrains.kotlin.jvm") version "2.1.20"
	id("org.jetbrains.intellij.platform") version "2.18.1"
}

group = "dev.tsrx.intellij_plugin"
version = "0.0.82"

repositories {
	mavenCentral()
	intellijPlatform {
		defaultRepositories()
	}
}

// Read more: https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin.html
dependencies {
	testImplementation("junit:junit:4.13.2")

	intellijPlatform {
		webstorm("2025.2.4")
		testFramework(org.jetbrains.intellij.platform.gradle.TestFrameworkType.Platform)

		// Add plugin dependencies for compilation here:
		bundledPlugin("org.jetbrains.plugins.textmate")
	}
}

intellijPlatform {
	pluginConfiguration {
		ideaVersion {
			sinceBuild = "252"
		}

		changeNotes = """
			<p>TSRX language support for IntelliJ Platform IDEs.</p>
			<ul>
				<li>TextMate syntax highlighting and baseline editor support.</li>
				<li>Optional language-server integration in supported JetBrains IDEs.</li>
			</ul>
		""".trimIndent()
	}
}

val generatedPluginResources = layout.buildDirectory.dir("generated/tsrx-plugin-resources")
val generatePluginResources by tasks.registering(Sync::class) {
	from(layout.projectDirectory.file("../../grammars/textmate/info.plist")) {
		into("textmate")
	}
	from(layout.projectDirectory.file("../../grammars/textmate/tsrx.tmLanguage.json")) {
		into("textmate/Syntaxes")
	}
	from(layout.projectDirectory.file("LICENSE")) {
		into("META-INF")
	}
	into(generatedPluginResources)
}

sourceSets.main {
	resources.srcDir(generatedPluginResources)
}

tasks {
	processResources {
		dependsOn(generatePluginResources)
	}

	// Set the JVM compatibility versions
	withType<JavaCompile> {
		sourceCompatibility = "21"
		targetCompatibility = "21"
	}
}

kotlin {
	compilerOptions {
		jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
	}
}
