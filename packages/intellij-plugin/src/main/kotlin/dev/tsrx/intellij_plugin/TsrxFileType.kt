package dev.tsrx.intellij_plugin

import com.intellij.openapi.fileTypes.LanguageFileType
import com.intellij.openapi.vfs.VirtualFile
import javax.swing.Icon

class TsrxFileType private constructor() : LanguageFileType(TsrxLanguage) {
	override fun getName(): String = "TSRX"

	override fun getDescription(): String = "TSRX language file"

	override fun getDefaultExtension(): String = "tsrx"

	override fun getIcon(): Icon = TsrxIcons.FILE

	companion object {
		@JvmField
		val INSTANCE = TsrxFileType()

		fun isTsrxFile(file: VirtualFile): Boolean {
			return file.extension?.lowercase() == "tsrx"
		}
	}
}
