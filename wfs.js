// FS written mainly by me, but fixed by Claude Haiku
var debug = false;
var opfsRoot, contents, handles, journalHandle, inodeHandle = undefined;
const WFSVer = 1;

function generateUID() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

function getExtension(filename) {
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex > 0) {
        return filename.substring(dotIndex + 1);
    }
    return undefined;
}

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

// Journal is designed to clean up files on crash, not recover them
// To be implemented before WebDesk 0.3.3 release
const journal = {
    check: function () {

    }
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
    mkdir: async function (data) {
        // Normalize and chop up path
        const normalized = normalizePath(data.path);
        const result = normalized.split("/").filter(Boolean);

        if (result.length === 0) {
            return handles;
        }

        // Climb through directories
        let currentDir = handles;

        for (const pathPart of result) {
            currentDir = await currentDir.getDirectoryHandle(
                pathPart,
                { create: true }
            );
        }

        // Return handle
        return currentDir;
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
    write: async function (data) {
        try {
            const checkExisting = await FS.ls({ path: data.path });
            if (debug === true) console.log(checkExisting);
            if (checkExisting) {
                await FS.rm({ path: data.path });
            }

            const content = data.content ?? data;

            // Infer type if not provided
            if (!data.type) {
                if (typeof content === "string") data.type = "text";
                else if (content instanceof Blob) data.type = "blob";
                else if (content instanceof Uint8Array || content instanceof ArrayBuffer) data.type = "bytes";
                else data.type = "text";
            }

            // Normalize and split path properly
            const normalizedPath = normalizePath(data.path);
            const lastSlash = normalizedPath.lastIndexOf("/");
            const dirName = lastSlash === -1 ? "" : normalizedPath.substring(0, lastSlash);
            const fileName = lastSlash === -1 ? normalizedPath : normalizedPath.substring(lastSlash + 1);

            if (!fileName) {
                console.error("Invalid filename");
                return false;
            }

            const uid = generateUID();

            let currentDir = await FS.mkdir({ path: dirName });
            if (!currentDir) {
                console.error("Failed to create directory");
                return false;
            }

            // Write file handle 

            await FS.writeHandleV1(currentDir, fileName, uid, false);

            // Write actual file to contents
            const contentfileHandle = await contents.getFileHandle(uid, { create: true });
            const contentWritable = await contentfileHandle.createWritable();

            if (data.type === "text") {
                await contentWritable.write(String(content));
            } else if (data.type === "blob") {
                await contentWritable.write(content);
            } else if (data.type === "bytes") {
                let bytes = content;
                if (content instanceof ArrayBuffer) bytes = new Uint8Array(content);
                await contentWritable.write(bytes);
            } else {
                await contentWritable.write(content);
            }

            // Write "inode"
            const inodefileHandle = await inodeHandle.getFileHandle(uid, { create: true });
            const inodeWritable = await inodefileHandle.createWritable();
            const inodeJSON = {
                uid,
                writtenAt: Date.now(),
                type: data.type,
                extension: getExtension(fileName),
                version: WFSVer,
            }

            await inodeWritable.write(JSON.stringify(inodeJSON));

            // Flush all writes
            await inodeWritable.close();
            await contentWritable.close();

            return true;
        } catch (error) {
            console.error("Write error:", error);
            return false;
        }
    },
    rm: async function (data) {
        // rm rewritten by Copilot
        // Normalize path and chop it up
        const normalized = normalizePath(data.path);
        const result = normalized.split("/").filter(Boolean);

        if (result.length === 0) {
            return false;
        }

        // Walk through path segments to reach target directory.
        let currentDir = handles;
        for (let i = 0; i < result.length - 1; i++) {
            try {
                currentDir = await currentDir.getDirectoryHandle(result[i]);
            } catch (err) {
                return null;
            }
        }

        const target = result[result.length - 1];

        try {
            const fileHandle = await currentDir.getFileHandle(target);
            const file = await fileHandle.getFile();
            const fcont = await file.text();
            const handleJSON = JSON.parse(fcont);

            await currentDir.removeEntry(target);
            await inodeHandle.removeEntry(handleJSON.uid);
            await contents.removeEntry(handleJSON.uid);
            return true;
        } catch (err) {
            // Not a file, try as directory
            try {
                await currentDir.removeEntry(target, { recursive: true });
                return true;
            } catch (removeErr) {
                return null;
            }
        }
    },
    read: async function (data) {
        const ls = await FS.ls({ path: data.path });

        if (!ls || ls.kind !== "file") {
            console.error("File not found:", data.path);
            return null;
        }

        const inode = ls.data;

        const fileHandle = await contents.getFileHandle(inode.uid);
        const file = await fileHandle.getFile();

        let fcont;

        if (inode.type === "text") {
            fcont = await file.text();
        } else if (inode.type === "blob") {
            fcont = file;
        } else if (inode.type === "bytes") {
            fcont = new Uint8Array(await file.arrayBuffer());
        } else {
            // Fallbackish
            fcont = await file.text();
        }

        inode["content"] = fcont;
        return inode;
    }
}

// Listen for requests from main thread
addEventListener('message', async (event) => {
    if (debug === true) console.log('Operation:', event.data);
    var result;

    // event.data.data is any params/data from the main thread
    const opType = event.data.data?.opType;

    try {
        if (opType === "init") {
            result = await FS.init(event.data.data);
        } else if (opType === "write") {
            result = await FS.write(event.data.data);
        } else if (opType === "read") {
            result = await FS.read(event.data.data);
        } else if (opType === "rm") {
            result = await FS.read(event.data.data);
        } else if (opType === "mkdir") {
            result = await FS.mkdir(event.data.data);
        } else if (opType === "ls") {
            result = await FS.ls(event.data.data);
        } else {
            console.error("Unknown operation:", opType);
            result = null;
        }
    } catch (error) {
        console.error("Operation failed:", error);
        result = null;
    }

    self.postMessage({ opNum: event.data.opNum, data: result });
});