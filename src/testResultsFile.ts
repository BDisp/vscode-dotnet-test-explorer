"use strict";
import * as fs from "fs";
import { Disposable } from "vscode";
import { DOMParser, Element, Node } from "xmldom";
import { TestResult } from "./testResult";

function findChildElement(node: Node, name: string): Node {
    let child = node.firstChild;
    while (child) {
        if (child.nodeName === name) {
            return child;
        }

        child = child.nextSibling;
    }

    return null;
}

function getAttributeValue(node: Node, name: string): string {
    const attribute = node.attributes.getNamedItem(name);
    return (attribute === null) ? null : attribute.nodeValue;
}

function getTextContentForTag(parentNode: Node, tagName: string): string {
    const node = parentNode.getElementsByTagName(tagName);
    return node.length > 0 ? node[0].textContent : "";
}

function parseUnitTestResults(xml: Element): TestResult[] {
    const results: TestResult[] = [];
    const nodes = xml.getElementsByTagName("UnitTestResult");

    // TSLint wants to use for-of here, but nodes doesn't support it
    for (let i = 0; i < nodes.length; i++) { // tslint:disable-line

        results.push(new TestResult(
            getAttributeValue(nodes[i], "testId"),
            getAttributeValue(nodes[i], "outcome"),
            getTextContentForTag(nodes[i], "Message"),
            getTextContentForTag(nodes[i], "StackTrace"),
        ));
    }

    return results;
}

function updateUnitTestDefinitions(xml: Element, results: TestResult[]): void {
    const nodes = xml.getElementsByTagName("UnitTest");
    const names = new Map<string, any>();

    for (let i = 0; i < nodes.length; i++) { // tslint:disable-line
        const id = getAttributeValue(nodes[i], "id");
        const testMethod = findChildElement(nodes[i], "TestMethod");
        if (testMethod) {
            names.set(id, {
                className: getAttributeValue(testMethod, "className"),
                method: getAttributeValue(testMethod, "name"),
            });
        }
    }

    for (const result of results) {
        const name = names.get(result.id);
        if (name) {
            result.updateName(name.className, name.method);
        }
    }
}

export class TestResultsFile {

    public parseResults(filePath: string): Promise<TestResult[]> {
        return new Promise( (resolve, reject) => {
            let results: TestResult[];
            fs.readFile(filePath, (err, data) => {
                if (!err) {
                    const xdoc = new DOMParser().parseFromString(data.toString(), "application/xml");
                    results = parseUnitTestResults(xdoc.documentElement);

                    updateUnitTestDefinitions(xdoc.documentElement, results);
                    resolve(results);
                }
            });

        });
    }
}

// export class TestResultsFile implements Disposable {
//     private static readonly ResultsFileName = "Results.trx";
//     private onNewResultsEmitter = new EventEmitter<TestResult[]>();
//     private resultsFile: string;
//     private watcher: fs.FSWatcher;

//     public dispose(): void {
//         try {
//             if (this.watcher) {
//                 this.watcher.close();
//             }

//             if (this.resultsFile) {
//                 // When we ask for a random directory it creates one for us,
//                 // however, we can't delete it if there's a file inside of it
//                 if (fs.existsSync(this.resultsFile)) {
//                     fs.unlinkSync(this.resultsFile);
//                 }

//                 fs.rmdir(path.dirname(this.resultsFile));
//             }

//         } catch (error) {
//         }
//     }

//     public get fileName(): string {
//         this.ensureTemproaryPathExists();
//         return this.resultsFile;
//     }

//     public resetResultFilePath() {
//         this.resultsFile = null;
//     }

//     public get onNewResults(): Event<TestResult[]> {
//         return this.onNewResultsEmitter.event;
//     }

//     private ensureTemproaryPathExists(): void {
//         if (!this.resultsFile) {
//             const tempFolder = fs.mkdtempSync(path.join(Utility.pathForResultFile, "test-explorer-"));
//             this.resultsFile = path.join(tempFolder, TestResultsFile.ResultsFileName);
//             this.watchFolder(this.resultsFile);
//         }
//     }

//     private parseResults(): void {
//         const emitter = this.onNewResultsEmitter;
//         fs.readFile(this.resultsFile, (err, data) => {
//             if (!err) {
//                 const xdoc = new DOMParser().parseFromString(data.toString(), "application/xml");
//                 const results = parseUnitTestResults(xdoc.documentElement);
//                 updateUnitTestDefinitions(xdoc.documentElement, results);
//                 emitter.fire(results);
//             }
//         });
//     }

//     private watchFolder(resultsFile: string): void {
//         const me = this;

//         chokidar.watch(resultsFile).on("all", (event, file) => {
//             me.parseResults();
//         });
//     }
// }
