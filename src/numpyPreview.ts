import * as vscode from 'vscode';

import * as fs from 'fs';
import { fromArrayBuffer } from 'numpy-parser';

import { Disposable } from './disposable';
import { OSUtils } from './utils';

type PreviewState = 'Disposed' | 'Visible' | 'Active';

function loadArrayBuffer(file : string) {
  const buffer = fs.readFileSync(file);                                                                                                                                                                                                                                                                                                                                                                                                                                                 
  return new Uint8Array(buffer).buffer; // only needed for node conversion
}

function wrapWithSqBr(s : string) {
  return '[' + s + ']';
}

function multiArrayToString (array : any, shape : any) {
  if (shape.length > 1) {
    const pieceNum : number = shape[0];
    const pieceSize : number = array.length / pieceNum;
    var res = new Array(pieceNum);
    for (var i = 0; i < pieceNum; i++) {
      res[i] = multiArrayToString(array[i], shape.slice(1, shape.length));
    }
    return wrapWithSqBr(res.toString());
  }
  else {
    return wrapWithSqBr(array.toString());
  }
}

function makeTableHTML(myArray : any) {
  var result = "<table border=''>";
  for(var i=0; i<myArray.length; i++) {
    result += "<tr>";
    for(var j=0; j<myArray[i].length; j++){
      result += "<td>"+myArray[i][j]+"</td>";
    }
    result += "</tr>";
  }
  result += "</table>";
  
  return result;
}

function show2DArr(array : any) {
  // Show array in an table
  // TODO: prettify it
  const tableHTML = makeTableHTML(array);
  return tableHTML;
}

function toMultiDimArray(array : any, shape : any) {
  if (shape.length > 1) {
    const pieceNum : number = shape[0];
    const pieceSize : number = array.length / pieceNum;
    var res = new Array(pieceNum);
    for (var i = 0; i < pieceNum; i++) {
      const begin = i * pieceSize;
      const end = array.length - (pieceNum - i - 1) * pieceSize;
      res[i] = toMultiDimArray(array.slice(begin, end), shape.slice(1, shape.length));
    }
    return res;
  }
  else {
    return array;
  }
}

function isLargerThanOne(element : any, index : any, array : any) 
{  
   return element > 1; 
} 

export class NumpyPreview extends Disposable {
  private _previewState: PreviewState = 'Visible';

  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly resource: vscode.Uri,
    private readonly webviewEditor: vscode.WebviewPanel
  ) {
    super();
    const resourceRoot = resource.with({
      path: resource.path.replace(/\/[^/]+?\.\w+$/, '/'),
    });

    webviewEditor.webview.options = {
      enableScripts: true,
      localResourceRoots: [resourceRoot, extensionRoot],
    };

    this._register(
      webviewEditor.webview.onDidReceiveMessage((message) => {
        switch (message.type) {
          case 'reopen-as-text': {
            vscode.commands.executeCommand(
              'vscode.openWith',
              resource,
              'default',
              webviewEditor.viewColumn
            );
            break;
          }
        }
      })
    );

    this._register(
      webviewEditor.onDidChangeViewState(() => {
        this.update();
      })
    );

    this._register(
      webviewEditor.onDidDispose(() => {
        this._previewState = 'Disposed';
      })
    );

    const watcher = this._register(
      vscode.workspace.createFileSystemWatcher(resource.fsPath)
    );
    this._register(
      watcher.onDidChange((e) => {
        if (e.toString() === this.resource.toString()) {
          this.reload();
        }
      })
    );
    this._register(
      watcher.onDidDelete((e) => {
        if (e.toString() === this.resource.toString()) {
          this.webviewEditor.dispose();
        }
      })
    );

    this.webviewEditor.webview.html = this.getWebviewContents();
    this.update();
  }

  private reload(): void {
    if (this._previewState !== 'Disposed') {
      this.webviewEditor.webview.postMessage({ type: 'reload' });
    }
  }

  private update(): void {
    if (this._previewState === 'Disposed') {
      return;
    }

    if (this.webviewEditor.active) {
      this._previewState = 'Active';
      return;
    }
    this._previewState = 'Visible';
  }

  private getWebviewContents(): string {
    var path = this.resource.path;
    switch (OSUtils.isWindows()) {
      case true: 
        path = this.resource.path.slice(1, );
        console.log('[+] Windows -> cut path', path);
        break;
      default:
        console.log('[+] NOT Windows', path);
    }
    const arrayBuffer = loadArrayBuffer(path);
    const { data: array, shape: arrayShape } = fromArrayBuffer(arrayBuffer);

    let tempShape : Array<Number> = arrayShape;
    var content : string = '';
    var realShape = tempShape.filter(isLargerThanOne);
    var realDim = realShape.length;
    // Create multi-dim array
    console.log('[+] Array dim is', realDim);
  
    if (realDim > 1) {
      // For multi dim
      console.log('[*] Process to show structure');
      var multiArr = toMultiDimArray(array, arrayShape);
      switch (arrayShape.length) {
        case 2:
          let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
          // TODO: import Table View for 2D array
          if (config.get('vscode-numpy-viewer.tableView')) {
            console.log('[*] Table view enabled, create html table');
            content = show2DArr(multiArr);
          }
          else {
            content = multiArrayToString(multiArr, arrayShape);
          }
          break;
        default:
          content = multiArrayToString(multiArr, arrayShape);
      }
    } 
    else { 
      // For single dim
      content = wrapWithSqBr(array.toString());
    }
    
    // Replace , with ,\n for reading
    var re = /,/gi;
    content = content.replace(re, `,\n`);
    const head = `<!DOCTYPE html>
    <html dir="ltr" mozdisallowselectionprint>
    <head>
    <meta charset="utf-8">
    </head>`;
    const tail = ['</html>'].join('\n');
    const output =  head + `<body>              
    <div id="x">` + content + `</div></body>` + tail;
    return output;
  }
}