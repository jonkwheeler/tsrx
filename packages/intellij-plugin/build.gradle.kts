import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.intellij.platform.gradle.models.ProductRelease
import org.jetbrains.intellij.platform.gradle.tasks.VerifyPluginTask

plugins {
	id("java")
	id("org.jetbrains.kotlin.jvm") version "2.1.20"
	id("org.jetbrains.intellij.platform") version "2.18.1"
}

group = "dev.tsrx.intellij_plugin"
version = providers.gradleProperty("pluginVersion").get()

val targetPlatformVersion = providers.gradleProperty("targetPlatformVersion").get()
val minimumPlatformVersion = providers.gradleProperty("minimumPlatformVersion").get()
val advertisedProductTypes = providers.gradleProperty("advertisedProductTypes").get()
	.split(',')
	.map(String::trim)
	.filter(String::isNotEmpty)
	.map(IntelliJPlatformType::valueOf)
val verificationProductType = providers.gradleProperty("verificationProductType").orNull
	?.let(IntelliJPlatformType::valueOf)
val verificationProductVersion = providers.gradleProperty("verificationProductVersion").orNull

require(advertisedProductTypes.distinct().size == advertisedProductTypes.size) {
	"advertisedProductTypes must not contain duplicates"
}
require(IntelliJPlatformType.WebStorm in advertisedProductTypes) {
	"advertisedProductTypes must include WebStorm"
}
require(IntelliJPlatformType.IntellijIdeaUltimate in advertisedProductTypes) {
	"advertisedProductTypes must include IntellijIdeaUltimate"
}
require((verificationProductType == null) == (verificationProductVersion == null)) {
	"verificationProductType and verificationProductVersion must be provided together"
}
require(verificationProductType == null || verificationProductType in advertisedProductTypes) {
	"verificationProductType must be one of the advertisedProductTypes"
}

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
		webstorm(targetPlatformVersion)
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

	pluginVerification {
		failureLevel = listOf(
			VerifyPluginTask.FailureLevel.COMPATIBILITY_PROBLEMS,
			VerifyPluginTask.FailureLevel.INTERNAL_API_USAGES,
			VerifyPluginTask.FailureLevel.OVERRIDE_ONLY_API_USAGES,
			VerifyPluginTask.FailureLevel.INVALID_PLUGIN,
		)
		ignoredProblemsFile = layout.projectDirectory.file("plugin-verifier-ignored-problems.txt")
		verificationReportsDirectory = layout.buildDirectory.dir("reports/pluginVerifier")
		verificationReportsFormats = VerifyPluginTask.VerificationReportsFormats.ALL.toList()

		ides {
			if (verificationProductType != null && verificationProductVersion != null) {
				if (verificationProductVersion == "latest") {
					latest {
						types = listOf(verificationProductType)
						channels = listOf(ProductRelease.Channel.RELEASE)
					}
				} else {
					create(verificationProductType, verificationProductVersion)
				}
			} else {
				create(IntelliJPlatformType.WebStorm, minimumPlatformVersion)
				create(IntelliJPlatformType.IntellijIdeaUltimate, minimumPlatformVersion)
				latest {
					types = advertisedProductTypes
					channels = listOf(ProductRelease.Channel.RELEASE)
				}
			}
		}
	}
}

val generatedPluginResources = layout.buildDirectory.dir("generated/tsrx-plugin-resources")
val tsrxLspVersion = providers.gradleProperty("tsrxLspVersion").get().trim()
require(tsrxLspVersion.isNotEmpty()) { "tsrxLspVersion must not be blank" }
val generatedLspVersion = resources.text.fromString("$tsrxLspVersion\n")
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
	from(generatedLspVersion.asFile()) {
		rename { "lsp-version.txt" }
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
