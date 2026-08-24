package dev.tsrx.intellij_plugin

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor

internal class TsrxLspServerDescriptor(
	project: Project,
	private val serverInfo: TsrxLanguageServer.ServerInfo,
) : ProjectWideLspServerDescriptor(project, "TSRX") {
	override fun isSupportedFile(file: VirtualFile): Boolean = TsrxFileType.isTsrxFile(file)

	override fun createCommandLine(): GeneralCommandLine {
		val commandLine = GeneralCommandLine(serverInfo.binary.toString(), "--stdio")
		serverInfo.root?.let { commandLine.withWorkDirectory(it.toFile()) }
		return commandLine
	}
}
