(async function () {
    function testFunc(btn) {
        UI.updateComponent(btn, {
            "styles": {
                "background": "#000",
                "color": "#fff",
            }
        });
    }

    console.log("we up");
    const win = await UI.win({ title: "hello" });
    console.log(win);
    const view = await UI.view(win);
    console.log(view);
    console.time("UI buttons - sandbox");

    let ct = 0;
    while (ct < 5000) {
        ct++;
        const now = ct;
        const btn = UI.button(view, { text: "Click me" });
        UI.listen(btn, { "event": "mouseover", "callback": () => testFunc(btn) });
    }

    console.timeEnd("UI buttons - sandbox");
})();