const UIState = {
    windowArray: [],
    zIndex: 9,
}

var UI = {
    deleteAll: function (element) {
        for (const el of Object.values(element.children)) {
            el.DOMel.remove();
        }
    },
    update: function (el, content) {
        const attr = content.data.attr;
        if (el) {
            function applyText(el) {
                if (attr.text) el.innerText = attr.text;
            }

            try {
                if (attr.styles) {
                    Object.entries(attr.styles).forEach(([name, value]) => {
                        el.DOMel.style[name] = value;
                    });
                }

                if (attr.classList) {
                    el.DOMel.classList = attr.classList;
                    if (attr.classList.includes("wd-normal-button")) {
                        const color = UI.div();
                        color.DOMel.classList = "wd-normal-button-inside";
                        el.DOMel.appendChild(color.DOMel);
                        applyText(color.DOMel);
                    } else {
                        applyText(el.DOMel);
                    }
                } else {
                    applyText(el.DOMel);
                }
            } catch (error) {
                console.log(error);
            }
        }
    },
    registerDrag: function (elmnt, dragHandle) {
        let startX = 0, startY = 0;
        let currentX = 0, currentY = 0;
        let dragging = false;

        elmnt.addEventListener("mousedown", function (event) {
            elmnt.style.zIndex = UIState.zIndex;
            UIState.zIndex++;
        });

        const target = dragHandle || elmnt;

        target.addEventListener("mousedown", dragStart);
        target.addEventListener("touchstart", dragStart, { passive: false });

        function getPoint(e) {
            const src = e.touches?.[0] ?? e.changedTouches?.[0] ?? e;
            return { x: src.clientX, y: src.clientY };
        }

        function dragStart(e) {
            if (e.target.tagName.toLowerCase().includes('button')) return;
            e.preventDefault();
            const p = getPoint(e);
            startX = p.x - currentX;
            startY = p.y - currentY;
            dragging = true;

            document.addEventListener("mousemove", dragMove);
            document.addEventListener("mouseup", dragEnd);
            document.addEventListener("touchmove", dragMove, { passive: false });
            document.addEventListener("touchend", dragEnd);
        }

        function dragMove(e) {
            if (!dragging) return;
            e.preventDefault();
            const p = getPoint(e);
            currentX = p.x - startX;
            currentY = p.y - startY;
            elmnt.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }

        function dragEnd() {
            if (!dragging) return;
            dragging = false;

            elmnt.style.left = (parseFloat(elmnt.style.left) || 0) + currentX + 'px';
            elmnt.style.top = (parseFloat(elmnt.style.top) || 0) + currentY + 'px';
            elmnt.style.transform = '';
            currentX = 0;
            currentY = 0;

            document.removeEventListener("mousemove", dragMove);
            document.removeEventListener("mouseup", dragEnd);
            document.removeEventListener("touchmove", dragMove);
            document.removeEventListener("touchend", dragEnd);
        }
    },
    _internalCreate: function (kind) {
        return document.createElement(kind);
    },
    window: function (content2) {
        const newWin = this._internalCreate("div");
        newWin.classList = "window";
        document.body.appendChild(newWin);
        let titleBar, content;

        function renderTitle(attr) {
            titleBar = UI._internalCreate("div");
            titleBar.classList = "window-titlebar";
            try {
                if (attr.title) titleBar.innerText = attr.title;
            } catch (error) {
                console.log(error);
            }
            newWin.appendChild(titleBar);
            UI.registerDrag(newWin, titleBar);
            return { DOMel: titleBar, children: {} };
        }

        function renderContent(attr) {
            content = UI._internalCreate("div");
            content.classList = "window-content";
            newWin.appendChild(content);
            return { DOMel: content, children: {} };
        }
        const element = { DOMel: newWin, renderTitle, renderContent, children: {} };
        UI.update(element, content2);
        return element;
    },
    div: function (parent) {
        const div = this._internalCreate("div");
        return { DOMel: div, children: {} };
    },
    button: function (id) {
        const btn = this._internalCreate("button");

        function updateComponent(data) {
            if (data.text) btn.innerText = data.text;
        }

        return { DOMel: btn, updateComponent, children: {} };
    },
    text: function (id) {
        const p = this._internalCreate("p");
        return { DOMel: p, children: {} };
    }
}