import * as vscode from 'vscode';
import { NumpyPreview } from './numpyPreview';
import { NumpyCustomProvider } from './numpyProvider';
import { getResourcePath } from './utils';

export function activate(context: vscode.ExtensionContext) {
	const extensionRoot = vscode.Uri.file(context.extensionPath);
	// Then register our provider
	const provider = new NumpyCustomProvider(extensionRoot);

	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(
			NumpyCustomProvider.viewType,
			provider,
			{
				webviewOptions: {
					enableFindWidget: true,
				}
			}
		)
	);

	function openTableView(uri?: vscode.Uri) {
		const panel = vscode.window.createWebviewPanel(
			'openWebview', // Identifies the type of the webview. Used internally
			'Table View', // Title of the panel displayed to the user
			vscode.ViewColumn.One, // Editor column to show the new webview panel in.
			{ // Enable scripts in the webview
				enableScripts: true //Set this to true if you want to enable Javascript. 
			}
		);
		const _getResourcePath = getResourcePath.bind(undefined, panel.webview, context);
		let tableCss = _getResourcePath('web/styles/table.css')
		var HTML = '';
		if (uri instanceof vscode.Uri) {
			HTML = NumpyPreview.getWebviewContents(uri.path, true, tableCss);
		}
		// console.log(HTML);
		panel.webview.html = HTML;
	  }

	const tableViewCommmand = vscode.commands.registerCommand('numpy-viewer.openTableView', openTableView,
	// () => {
	// 	vscode.window.showInformationMessage('Table View Mode');
	// 	// TODO: with this command, open a new editor to show a table to show the data
	// }
	);
	context.subscriptions.push(tableViewCommmand,);
}

// this method is called when your extension is deactivated
export function deactivate(): void {}
