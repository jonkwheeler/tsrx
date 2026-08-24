package dev.tsrx.intellij_plugin

import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspServerSupportProvider

class TsrxLspServerSupportProvider : LspServerSupportProvider {
	override fun fileOpened(
		project: Project,
		file: VirtualFile,
		serverStarter: LspServerSupportProvider.LspServerStarter,
	) {
		if (!TsrxFileType.isTsrxFile(file)) {
			return
		}

		val serverInfo = TsrxLanguageServer.resolveServer(project, file) ?: return
		serverStarter.ensureServerStarted(TsrxLspServerDescriptor(project, serverInfo))
	}
}
