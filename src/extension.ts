import * as vscode from 'vscode'

const EXTENSION_NAME = 'universalFormatOnType'

class UniversalOnTypeFormattingProvider implements vscode.OnTypeFormattingEditProvider {
    public async provideOnTypeFormattingEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        ch: string,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): Promise<vscode.TextEdit[]> {
        let formatRange

        switch (ch) {
            case '}':
                const editor = vscode.window.activeTextEditor!
                await vscode.commands.executeCommand('editor.action.jumpToBracket')
                formatRange = new vscode.Range(editor.selection.active, position)
                editor.selection = new vscode.Selection(position, position)
                break
            case '\n':
            case ';':
                const currentLine = ch === '\n' ? position.line - 1 : position.line
                const start = currentLine > 0 ? document.lineAt(currentLine - 1).range.end : new vscode.Position(0, 0)
                const end = currentLine < document.lineCount - 1 ? new vscode.Position(currentLine + 1, 0) : document.lineAt(currentLine).rangeIncludingLineBreak.end
                formatRange = new vscode.Range(start, end)
                break
        }

        return await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>('vscode.executeFormatRangeProvider', document.uri, formatRange, options) ?? []
    }
}

function setup(context: vscode.ExtensionContext) {
    // unregister all previous subscriptions except the one from onDidChangeConfiguration()
    while (context.subscriptions.length > 1) {
        context.subscriptions.pop()?.dispose()
    }

    const config = vscode.workspace.getConfiguration(EXTENSION_NAME)
    const langToTriggerChars = new Map<string, string[]>()

    function setdefault(lang: string) {
        const def: string[] = []
        langToTriggerChars.set(lang, def)
        return def
    }

    for (const [variantKey, variantChar] of [['brace', '}'], ['newline', '\n'], ['semicolon', ';']]) {
        for (const lang of config.get<string[]>(variantKey) ?? []) {
            (langToTriggerChars.get(lang) ?? setdefault(lang)).push(variantChar)
        }
    }

    for (const [lang, triggerChars] of langToTriggerChars) {
        context.subscriptions.push(
            vscode.languages.registerOnTypeFormattingEditProvider(lang, new UniversalOnTypeFormattingProvider(), triggerChars.shift()!, ...triggerChars)
        )
    }
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(evt => {
            if (evt.affectsConfiguration(`${EXTENSION_NAME}`)) {
                setup(context)
            }
        })
    )

    setup(context)
}

export function deactivate() { }
