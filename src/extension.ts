
import * as vscode from 'vscode';
import * as ts from "typescript";

export function activate(context: vscode.ExtensionContext) {
	
	console.log('Congratulations, your extension "if-ifdef-conditioner" is now active!');

	let timeout: NodeJS.Timer | undefined = undefined;

	const inactiveDecorationType = vscode.window.createTextEditorDecorationType({
		light: {
			// this color will be used in light color themes
			color: "#999999",
		},
		dark: {
			// this color will be used in dark color themes
			color: "#666666",
		}
	});

	let activeEditor = vscode.window.activeTextEditor;
	const sym_block: vscode.DecorationOptions[] = [];
	
	enum symName {
		if		='#if ',
		elif	='#elif ',
		ifdef	='#ifdef ',
		ifndef	='#ifndef ',
		else	='#else',
		endif 	='#endif',
	}

	const symNameVal = Object.values(symName)

	function getDefType(line_txt: string): string {
		console.log('line_txt' + line_txt);
		for(let idx=0; idx<symNameVal.length; idx++)
		{
			let pos = line_txt.indexOf(symNameVal[idx]);
			if(pos >= 0)
			{
				return symNameVal[idx];
			}
		}
		return '';
	}

	function GetInactiveType(if_line_txt: string): [number, string] {
		console.log('check symbol : ' + if_line_txt);
		var keys = if_line_txt.split(/[\s\t]+/); 
		let regEx = /[_a-zA-Z][0-9a-zA-Z_]+/g;
		let code = if_line_txt;
		let match;

		let sym_kind = getDefType(code)
		switch(sym_kind){
			case symName.ifdef:
				code = code.replace('#ifdef',' ');
				break;
			case symName.ifndef:
				code = code.replace('#ifndef ','!(');
				code += ')';
				break;
			case symName.if:
				code = code.replace('#if','');
				break;
			case symName.elif:
				code = code.replace('#elif','');
				break;
		}
		
		code = code.replace(/defined/gi,'');

		const predef_set = vscode.workspace.getConfiguration();
		let predef_symbols: {symbol:string, val:number }[] = predef_set.get('if-conditioner.symbols', []);
		let code_tmp = code;
		let checked_symbol = false;
		let symbol_name = "";

		while ((match = regEx.exec(code_tmp)) != null){
			//console.log('match:'+ match[0])
			let tmp_key:string = match[0];
			const result = predef_symbols.find(e => e.symbol === tmp_key );
			if(result !== undefined){
				code = code.replace(tmp_key, result.val.toString());
				checked_symbol = true;
				symbol_name = result.symbol;
			}
			else {
				code = code.replace(tmp_key, '1');
			}
			//console.log('code:'+ code);
		}

		if(checked_symbol == true){
			//console.log('code:'+ code);
			let result = ts.transpile(code);
			let isActiv :any = eval(result);
			console.log('is active : ' + isActiv);
	
			if(isActiv) {
				return [1, symbol_name];
			} else {
				return [0, symbol_name];
			}
		}

		return [-1, symbol_name];
	}

	function addInactiveBlock(curr_line:number, start_line:number, symbol: string): number {
		if (!activeEditor) {
			return start_line;
		}

		if((start_line >= 0) && (curr_line > 0) && ((curr_line-start_line) > 0)) {
			const prev_line_str = activeEditor.document.lineAt(curr_line-1).text;
			let start_pos = new vscode.Position(start_line + 1, 0);
			let end_pos = new vscode.Position(curr_line-1, prev_line_str.length);
			const decoration = { range: new vscode.Range(start_pos, end_pos), hoverMessage: 'Inactivated by "' + symbol + '"' };
			sym_block.push(decoration);
		}

		return -1;
	}

	function checkIfBlock(start_line:number, exit_with_endif: boolean): number {
		if (!activeEditor) {
			return start_line;
		}

		let i = start_line;
		let block_start_line = -1;
		let if_block_started = false;
		let cur_if_st = -1;
		let symbol = "";
		
		for (; i < activeEditor.document.lineCount; i++) {
			const line_str = activeEditor.document.lineAt(i);
			const line_txt = line_str.text;
			
			if(line_txt.match(/^[\s\t]*#/))
			{
				let sym_kind = getDefType(line_txt)

				switch(sym_kind){
					case symName.elif:{
						if(cur_if_st == 0){
							block_start_line = addInactiveBlock(i, block_start_line, symbol);
						}
						else if(cur_if_st == -1){
							[ cur_if_st, symbol ] = GetInactiveType(line_txt);
							if( cur_if_st == 0) {
								block_start_line = i;
							}
						}
						break;
					}
					case symName.if:
					case symName.ifdef:
					case symName.ifndef:
					{
						if(if_block_started == false){
							if_block_started = true;
							
							[ cur_if_st, symbol ] = GetInactiveType(line_txt);
							if( cur_if_st == 0) {
								block_start_line = i;
							}
						}
						else {
							i = checkIfBlock(i, true);
						}
						break;
					}
					case symName.else:{
						if(cur_if_st == 0){
							block_start_line = addInactiveBlock(i, block_start_line, symbol);
						}
						else if(cur_if_st == 1){
							block_start_line = i;
						}
						break;
					}
					case symName.endif:{
						block_start_line = addInactiveBlock(i, block_start_line, symbol);
						if(exit_with_endif == true){
							return i;
						}
						break;
					}
				}
			}
		}

		return i;
	}

	function updateDecorations() {
		if (!activeEditor) {
			return;
		}

		//Empty sym_block
		sym_block.splice(0, sym_block.length);

		checkIfBlock(0, false);
		
		activeEditor.setDecorations(inactiveDecorationType, sym_block);
	}

	function triggerUpdateDecorations() {
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		timeout = setTimeout(updateDecorations, 500);
	}

	if (activeEditor) {
		triggerUpdateDecorations();
	}

	let disposable = vscode.commands.registerCommand('if-conditioner.setSymbolValue', async () => {
		const editor = vscode.window.activeTextEditor;

		if(editor) {
			const document = editor.document;
			const symbol = document.getText(editor.selection);

			if(symbol) {
				const configuration = vscode.workspace.getConfiguration();
				let predef_symbols: {symbol:string, val:number }[] = configuration.get('if-conditioner.symbols', []);

				const exist_symbol = predef_symbols.find(e => e.symbol === symbol );
				const exist_symbol_idx = predef_symbols.findIndex(e => e.symbol === symbol );

				if (vscode.workspace.workspaceFolders) {
					if(exist_symbol === undefined){
						//Add

						const value = await vscode.window.showInputBox({value: '0', prompt: 'Provide a value for "' + symbol + '"' });

						if(value) {
							const newValue: {symbol:string, val:number } = { symbol: symbol, val: parseInt(value) };

							predef_symbols.push(newValue);

							await configuration.update('if-conditioner.symbols', predef_symbols, vscode.ConfigurationTarget.Global);
						}
					}
					else {
						const target = await vscode.window.showQuickPick(
							[
								{ label: 'Delete', description: 'Delete Predefine Symbol', target: 'delete' },
								{ label: 'Modify', description: 'Workspace Folder Settings', target: 'modify' }
							],
							{ placeHolder: 'Select the menu' });

						if (target) {
							if (target.target === 'delete'){
								predef_symbols.splice(exist_symbol_idx, 1);
								await configuration.update('if-conditioner.symbols', predef_symbols, vscode.ConfigurationTarget.Global);
							}
							else {
								const value = await vscode.window.showInputBox({value: exist_symbol.val.toString(), prompt: 'Provide a value for "' + symbol + '"' });

								if(value) {
									const newValue: {symbol:string, val:number } = { symbol: symbol, val: parseInt(value) };
									predef_symbols.splice(exist_symbol_idx, 1);
									predef_symbols.push(newValue);
									await configuration.update('if-conditioner.symbols', predef_symbols, vscode.ConfigurationTarget.Global);
								}
							}
						}
					}
				}
			}
		}
	});

	context.subscriptions.push(disposable);

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeConfiguration(event => {
		triggerUpdateDecorations();
	}, null, context.subscriptions);
}

// this method is called when your extension is deactivated
export function deactivate() {}
