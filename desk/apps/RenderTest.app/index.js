(async function () {
    async function gridTest() {
        function randomRGB() {
            return Math.floor(Math.random() * 256);
        }

        function testFunc(btn, event) {
            if (event.buttons === 1) {
                UI.updateComponent(btn, {
                    "styles": {
                        "background": `rgb(${randomRGB()}, ${randomRGB()}, ${randomRGB()})`,
                        "color": `rgb(${randomRGB()}, ${randomRGB()}, ${randomRGB()})`,
                    }
                });
            }
        }

        const win = UI.win.create();
        const title = UI.win.titleBar(win, { title: "DOM hell" });
        const content = UI.win.content(win);
        UI.updateComponent(content, {
            "styles": {
                "padding": "0px"
            }
        });

        const view = await UI.div(content, {
            "styles": {
                "display": "grid",
                "grid-template-columns": "repeat(auto-fill, 5px)",
                "grid-template-rows": "repeat(auto-fill, 5px)",
                "justify-content": "start",
                "align-content": "start",
                "width": "480px",
            }
        });

        console.time("UI buttons - sandbox");
        console.log("making buttons");

        let ct = 0;
        while (ct < 9999) {
            ct++;
            const now = ct;
            const btn = UI.div(view, {
                "styles": {
                    "background": `#fff`,
                    "color": `#000`,
                    "width": "5px",
                    "height": "5px",
                    "max-width": "5px",
                    "max-height": "5px",
                    "border": "none",
                    "margin": "0px",
                    "padding": "0px",
                    "font-size": "0px",
                    "display": "block"
                }
            });

            UI.listen(btn, { "event": "mouseenter", "callback": (event) => testFunc(btn, event) });
            UI.listen(btn, { "event": "mousedown", "callback": (event) => testFunc(btn, event) });
        }

        console.timeEnd("UI buttons - sandbox");
    }

    async function filesTest() {
        const win = UI.win.create({
            "styles": {
                "width": "300px",
                "height": "200px"
            }
        });

        const titleBar = UI.win.titleBar(win, {
            "title": "Files",
        });
        const content = UI.win.content(win);

        console.log(win);

        console.log("next")

        const filesView = UI.div(content, {
            "classList": "wd-button-list",
        });

        async function readAndLog(toRead) {
            const read = await FS.read(toRead);
            console.log(read.content);
        }

        async function nav(path) {
            const getAll = await FS.ls(path);
            UI.reset(filesView);
            for (const [name, info] of getAll.data) {
                const item = UI.button(filesView, {
                    "text": "(" + info.kind + ") " + name,
                    "classList": "wd-normal-button"
                });

                if (info.kind === "directory") {
                    UI.listen(item, { "event": "click", "callback": () => nav(path + name + "/") });
                } else {
                    UI.listen(item, { "event": "click", "callback": () => readAndLog(path + name) });
                }
            }
        }

        await nav("/")
    }

    await filesTest();
    await gridTest();
})();