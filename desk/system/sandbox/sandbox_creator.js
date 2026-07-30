async function createSandbox(appDetails) {
    return new Promise(async (resolve) => {
        const frameID = crypto.randomUUID();

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
            /*  */

            const channel = new MessageChannel();
            frame.contentWindow.postMessage({
                "op": "init",
                "frameID": frameID,
            }, "*", [channel.port2]);

            const validFunctions = {
                window: UI.window,
                win_title: function () {

                }
            }

            function render(pending) {
                // THIS NEEDS TO BE REFACTORED
                const content = pending.content;
                const elID = content.data.elID;
                UINum = content.UINum;
                let element;

                const UIConstructor = {

                }

                function standardRemove() {
                    UI.deleteAll(this);
                    this.DOMel.remove();
                }

                if (content.data.type === "win") {
                    element = UI.window(content);
                    element.remove = standardRemove;
                } else if (content.data.type === "win_title") {
                    const win = frameEls[content.data.parent];
                    if (win) {
                        element = win.renderTitle(content.data.attr);
                        element.remove = standardRemove;
                    } else {
                        console.log("No WINDOW");
                    }
                } else if (content.data.type === "win_content") {
                    const win = frameEls[content.data.parent];
                    if (win) {
                        element = win.renderContent();
                        element.remove = standardRemove;
                    } else {
                        console.log("No WINDOW");
                    }
                } else if (content.data.type === "div") {
                    const parent = frameEls[content.data.parent];
                    if (parent) {
                        element = UI.div(parent);
                        UI.update(element, content);
                        parent.children[elID] = element;
                    } else {
                        console.log("No parent");
                    }
                } else if (content.data.type === "button") {
                    const parent = frameEls[content.data.parent];
                    if (parent) {
                        const newBtn = UI.button(parent);
                        newBtn.remove = function () {
                            newBtn.DOMel.remove();
                        }
                        parent.children[elID] = newBtn;
                        element = newBtn;
                        UI.update(newBtn, content);
                    } else {
                        console.log("No parent");
                    }
                } else if (content.data.type === "update") {
                    UI.update(frameEls[content.data.id], content);
                } else if (content.data.type === "listen") {
                    const el = frameEls[content.data.id];
                    if (el) {
                        el.DOMel.addEventListener(content.data.attr.event, function (event) {
                            const processing = {
                                id: elID,
                                "event": content.data.attr.event,
                                "buttons": event.buttons,
                                "x": event.clientX,
                                "y": event.clientY
                            }
                            const sendBack = { "op": "UIEvent", "content": { UINum, data: processing } };
                            addToEvents(sendBack);
                            return;
                        });
                        // used to be { once: true } idk what I wanna do yet
                    } else {
                        console.log("NO ELEMENT");
                    }
                } else if (content.data.type === "reset") {
                    const el = frameEls[content.data.id];
                    if (el) {
                        UI.deleteAll(el);
                    } else {
                        console.log("NO ELEMENT");
                    }
                }

                if (!element) {
                    // console.error("Failed to create", content.data.type, content.data);
                } else {
                    frameEls[elID] = element;
                }

                const processing = {
                    id: elID,
                    success: true,
                }
                const sendBack = { "op": "UI", "content": { UINum, data: processing } };
                addToPost(sendBack);
            }

            channel.port1.onmessage = async (event) => {
                if (event.data.frameID !== frameID) {
                    console.log("reject!");
                    return;
                }

                if (event.data.op === "FS") {
                    const opNum = event.data.content.opNum;
                    const processing = await FS.noBoiler(event.data.content.data);
                    const sendBack = { "op": "FS", "content": { opNum, data: processing } };
                    // frame.contentWindow.postMessage(sendBack, "*");
                    channel.port1.postMessage(sendBack);
                } else if (event.data.op === "UI") {
                    const pending = JSON.parse(event.data.pending);
                    for (const pendingItem of pending) {
                        await render(pendingItem);
                    }

                    const avoidFuckery = toPost;
                    toPost = [];
                    const sendBack = { "op": "UI", pending: JSON.stringify(avoidFuckery) };
                    // frame.contentWindow.postMessage(sendBack, "*");
                    channel.port1.postMessage(sendBack);
                }
            };

            setInterval(function () {
                const pending = events;
                events = [];
                const sendBack = { "op": "UIEvent", pending: JSON.stringify(pending) };
                channel.port1.postMessage(sendBack);
            }, 5);
        }

        /* setInterval(function () {
            const pending = toPost;
            toPost = [];
            const sendBack = { "op": "UI", pending: JSON.stringify(pending) };
            frame.contentWindow.postMessage(sendBack, "*");
        }, 20); */

        const frameCont = await FS.read("/system/sandbox/sandbox.html");
        frame.src = htmlToBase64Url(frameCont.content);
        document.body.appendChild(frame);
    });
}