This provides syntax highlighting for TSRX files in editors that support TextMate
grammars, such as WebStorm/IntelliJ and Sublime Text.

# Installation

1. Create a directory named `TSRX.tmbundle`.
2. Create a directory named `Syntaxes` inside the `TSRX.tmbundle` directory.
3. Save the [`tsrx.tmLanguage`](./Syntaxes/tsrx.tmLanguage) file into the
   `Syntaxes` directory.
4. Install it:
   - **WebStorm/IntelliJ**:
     1. Save the [`info.plist`](./info.plist) file into the `TSRX.tmbundle`
        directory.
     2. Go to `Settings` > `Editor` > `TextMate Bundles`, click the `+` icon, and
        select the `TSRX.tmbundle` directory.
     3. All `.tsrx` files should now have syntax highlighting.
   - **Sublime Text**:
     1. Go to `Preferences` > `Browse Packages`, and move the `TSRX.tmbundle`
        directory into the opened folder.
     2. You should now be able to select `TSRX` in `View` > `Syntax`.
