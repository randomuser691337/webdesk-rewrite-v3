// FS written mainly by me, but fixed by Claude Haiku
var debug = false;
var opfsRoot, contents, handles, journalHandle, inodeHandle = undefined;
const WFSVer = 1;

function normalizePath(path) {
    if (!path) return '';
    return path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}

function ensureSlash(path) {
    if (!path) return '';
    path = normalizePath(path);
    if (path && !path.endsWith('/')) {
        path += '/';
    }
    return path;
}

const FS = {
    init: async function () {
        // Initialize filesystem and create if not existing already
        if (!navigator.storage) {
            return false;
        } else {
            opfsRoot = await navigator.storage.getDirectory();
            handles = await opfsRoot.getDirectoryHandle("handles", {
                create: true,
            });
            contents = await opfsRoot.getDirectoryHandle("contents", {
                create: true,
            });
            journalHandle = await opfsRoot.getDirectoryHandle("journal", {
                create: true,
            });
            inodeHandle = await opfsRoot.getDirectoryHandle("inodes", {
                create: true,
            });
            return true;
        }
    },
    handleJSON: function (uid, symlink) {
        const JSONObj = {
            "version": WFSVer,
            "uid": uid,
            "symlink": symlink,
        }
        return JSONObj;
    },
    writeHandleV1: async function (currentDir, filename, uid, isSymlink = false) {
        if (debug === true) console.log(currentDir + filename, uid, isSymlink);
        // Make handle's handle (LOL)
        const handlefileHandle = await currentDir.getFileHandle(filename, { create: true });
        const handleWritable = await handlefileHandle.createWritable();
        // Create file info to write
        const jsonHandled = FS.handleJSON(uid, isSymlink);
        // Write and close
        await handleWritable.write(JSON.stringify(jsonHandled));
        await handleWritable.close();
        if (debug === true) console.log("done");
    },
    ls: async function (data) {
        // Normalize path and chop it up
        const normalized = normalizePath(data.path);
        const result = normalized.split("/").filter(Boolean);

        // Walk through path segments. The last segment may be a file
        let currentDir = handles;

        for (let i = 0; i < result.length; i++) {
            const pathPart = result[i];

            if (i === result.length - 1) {
                try {
                    if (data.noData === true) {
                        await currentDir.getFileHandle(pathPart);
                        return {
                            "kind": "file"
                        }
                    } else {
                        // Try to get as file first
                        let handleJSON;
                        async function parseHandle(noretry) {
                            const fileHandle = await currentDir.getFileHandle(pathPart);
                            const file = await fileHandle.getFile();
                            const fcont = await file.text();
                            try {
                                handleJSON = JSON.parse(fcont);
                            } catch (error) {
                                if (debug === true) console.log(error);
                                if (noretry !== true) {
                                    if (debug === true) console.log("<!> The handle exists, it's probably version 0. Converting and trying again");
                                    await FS.writeHandleV1(currentDir, pathPart, fcont, false);
                                    if (debug === true) console.log("Retry")
                                    await parseHandle(true);
                                } else {
                                    return false;
                                }
                            }
                        }

                        await parseHandle();

                        if (debug === true) console.log(handleJSON);

                        const inode = await inodeHandle.getFileHandle(handleJSON.uid);
                        const mdata = await inode.getFile();
                        const mfile = JSON.parse(await mdata.text());

                        return {
                            "kind": "file",
                            "data": mfile,
                        }
                    }
                } catch (err) {
                    // Not a file - try as directory
                }
            }

            try {
                currentDir = await currentDir.getDirectoryHandle(pathPart);
            } catch (err) {
                return null;
            }
        }

        // Map contents of final directory out
        if (data.noData === true) {
            return {
                "kind": "directory",
            };
        } else {
            // I barely understand Maps but I'm using them because it's the "right" thing to do
            const entries = new Map();
            for await (const entry of currentDir.values()) {
                const entryPath = ensureSlash(data.path) + entry.name;
                entries.set(entry.name, await FS.ls({ path: entryPath, noData: true }));
            }

            return {
                "kind": "directory",
                "data": entries,
            };
        }
    },
    read: async function (data) {
        const init = await FS.init();
        if (init === true) {
            const ls = await FS.ls({ path: data.path });

            if (!ls || ls.kind !== "file") {
                console.error("File not found:", data.path);
                return null;
            }

            const inode = ls.data;

            const fileHandle = await contents.getFileHandle(inode.uid);
            const file = await fileHandle.getFile();

            const fcont = await file.text();
            if (fcont === "FAIL!") {
                console.log("<!!!> Something's fucked. Sandbox breach! " + fcont);
                return false;
            } else {
                return true;
            }
        }
    }
}

FS.read("/system/sandbox/perm_test.txt");