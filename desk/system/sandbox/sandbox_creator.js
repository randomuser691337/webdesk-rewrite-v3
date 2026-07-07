let boxIDV = 0;

function boxID() {
    boxIDV++;
    return boxIDV;
}

async function createSandbox(appDetails) {
    return new Promise(async (resolve) => {
        const frameID = boxID();

        function htmlToBase64Url(htmlString) {
            const bytes = new TextEncoder().encode(htmlString);
            const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
            const base64 = btoa(binString);
            return `data:text/html;base64,${base64}`;
        }

        const frame = UI._internalCreate("iframe");
        frame.style = `border: none; width: 1px; height: 1px; left: -2px; top: -2px;`;
        frame.sandbox = "allow-scripts";
        const frameEls = {};
        let toPost = [];
        let events = [];

        function addToPost(item) {
            toPost.push(item);
        }

        function addToEvents(item) {
            events.push(item);
        }

        frame.onload = async function () {
            frame.contentWindow.postMessage({
                "op": "init",
                "uFrameID": frameID
            }, "*");

            window.addEventListener('message', async (event) => {
                if (event.data.frameID !== frameID) {
                    return;
                }

                if (event.data.op === "initDone") {
                    resolve();
                }

                if (event.data.op === "FS") {
                    const opNum = event.data.content.opNum;
                    const processing = await FS.noBoiler(event.data.content.data);
                    const sendBack = { "op": "FS", "content": { opNum, data: processing } };
                    frame.contentWindow.postMessage(sendBack, "*");
                } else if (event.data.op === "UI") {
                    const pending = JSON.parse(event.data.pending)
                    pending.forEach(pending => {
                        const content = pending.content;
                        const elID = content.data.elID;
                        UINum = content.UINum;
                        let element;
                        if (content.data.type === "win") {
                            element = UI.window(content.data.attr.title);
                        } else if (content.data.type === "view") {
                            const win = frameEls[content.data.parent];
                            if (win) {
                                const newView = UI.view();
                                win.content.appendChild(newView);
                                element = newView;
                            }
                        } else if (content.data.type === "button") {
                            const parent = frameEls[content.data.parent];
                            if (parent) {
                                const newBtn = UI.button();
                                newBtn.DOMel.innerText = content.data.attr.text;
                                parent.appendChild(newBtn.DOMel);
                                element = newBtn;
                            }
                        } else if (content.data.type === "update") {
                            const el = frameEls[content.data.id];
                            const attr = content.data.attr;
                            if (el) {
                                if (attr.text) el.DOMel.innerText = attr.text;
                                if (attr.styles) {
                                    Object.entries(attr.styles).forEach(([name, value]) => {
                                        el.DOMel.style[name] = value;
                                    });
                                }
                            }
                        } else if (content.data.type === "listen") {
                            const el = frameEls[content.data.id];
                            if (el) {
                                el.DOMel.addEventListener(content.data.attr.event, function (event) {
                                    const processing = {
                                        id: elID,
                                        "event": content.data.attr.event,
                                        /* "x": event.clientX,
                                        "y": event.clientY */
                                    }
                                    const sendBack = { "op": "UIEvent", "content": { UINum, data: processing } };
                                    addToEvents(sendBack);
                                    return;
                                }, { "once": true });
                            } else {
                                console.log("NO ELEMENT")
                            }
                        }

                        frameEls[elID] = element;
                        const processing = {
                            id: elID,
                            success: true,
                        }
                        const sendBack = { "op": "UI", "content": { UINum, data: processing } };
                        addToPost(sendBack);
                    });
                }
            });
        }

        setInterval(function () {
            const pending = toPost;
            toPost = [];
            const sendBack = { "op": "UI", pending: JSON.stringify(pending) };
            frame.contentWindow.postMessage(sendBack, "*");
        }, 20);

        setInterval(function () {
            const pending = events;
            events = [];
            const sendBack = { "op": "UIEvent", pending: JSON.stringify(pending) };
            frame.contentWindow.postMessage(sendBack, "*");
        }, 5);

        const frameCont = await FS.read("/system/sandbox/sandbox.html");
        frame.src = htmlToBase64Url(frameCont.content);
        document.body.appendChild(frame);
    })
}