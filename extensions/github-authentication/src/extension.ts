/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { GitHubAuthenticationProvider, UriEventHandler } from './github';


function initGHES(context: vscode.ExtensionContext, uriHandler: UriEventHandler) {
	const settingValue = vscode.workspace.getConfiguration().get<string>('github-enterprise.uri');
	if (!settingValue) {
		return undefined;
	}

	// validate user value
	let uri: vscode.Uri;
	try {
		uri = vscode.Uri.parse(settingValue, true);
	} catch (e) {
		vscode.window.showErrorMessage(vscode.l10n.t('GitHub Enterprise Server URI is not a valid URI: {0}', e.message ?? e));
		return;
	}

	const githubEnterpriseAuthProvider = new GitHubAuthenticationProvider(context, uriHandler, uri);
	context.subscriptions.push(githubEnterpriseAuthProvider);
	return githubEnterpriseAuthProvider;
}

export function activate(context: vscode.ExtensionContext) {
	const uriHandler = new UriEventHandler();
	context.subscriptions.push(uriHandler);
	context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));


	// let disposable = vscode.commands.registerCommand('extension.myExtension', async () => {
	// 	try {
	// 		// Execute the git.clone command
	// 		await vscode.commands.executeCommand('git.clone');
	// 		vscode.window.showInformationMessage('Git clone command executed successfully!');
	// 	} catch (error) {
	// 		vscode.window.showErrorMessage(`Error executing git.clone command: ${error.message}`);
	// 	}
	// });
	// context.subscriptions.push(disposable);


	context.subscriptions.push(new GitHubAuthenticationProvider(context, uriHandler));

	let githubEnterpriseAuthProvider: GitHubAuthenticationProvider | undefined = initGHES(context, uriHandler);

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e => {
		if (e.affectsConfiguration('github-enterprise.uri')) {
			if (vscode.workspace.getConfiguration().get<string>('github-enterprise.uri')) {
				githubEnterpriseAuthProvider?.dispose();
				githubEnterpriseAuthProvider = initGHES(context, uriHandler);
			}
		}
	}));

}
// async function executeGitCloneCommand() {
// 	try {
// 		// Execute the git.clone command
// 		await vscode.commands.executeCommand('git.clone');
// 		vscode.window.showInformationMessage('Git clone command executed successfully!');
// 	} catch (error) {
// 		vscode.window.showErrorMessage(`Error executing git.clone command: ${error.message}`);
// 	}

// }
