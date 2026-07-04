var countUp = 0;

function gen() {
    countUp++;
    return countUp;
}

const UIState = {
    windowArray: []
}

var UI = {
    focusWin: function (elmnt) {
        if (UIState.windowArray.at(-1) === elmnt) return;
        const BASE_Z = 100;
        const topZ = parseInt(UIState.windowArray.at(-1).style.zIndex) || BASE_Z;
        elmnt.style.zIndex = topZ + 1;
        const index = UIState.windowArray.indexOf(elmnt);
        if (index > -1) UIState.windowArray.splice(index, 1);
        UIState.windowArray.push(elmnt);
    },
    registerDrag: function (elmnt, dragHandle) {
        const BASE_Z = 100;
        const lastZ = UIState.windowArray.length > 0
            ? (parseInt(UIState.windowArray.at(-1).style.zIndex) || BASE_Z)
            : BASE_Z;
        elmnt.style.zIndex = lastZ + 1;
        UIState.windowArray.push(elmnt);

        elmnt.addEventListener('mousedown', () => UI.focusWin(elmnt));
        elmnt.addEventListener('touchstart', () => UI.focusWin(elmnt), { passive: true });

        let startX = 0, startY = 0;
        let currentX = 0, currentY = 0;
        let dragging = false;

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
    _exportUI: function (element) {
        const _pointers = {}

        function noBoilerPlate(type) {
            const btn = UI._internalCreate(type);
            const refid = gen();
            btn.id = refid;

            function innerText(txt) {
                btn.innerText = txt;
            }

            function remove() {
                delete _pointers[refid];
                btn.remove();
            }

            function addEvent(type, callback) {
                if (type === "click") {
                    btn.addEventListener("click", callback);
                } else if (type === "rightClick") {
                    btn.addEventListener("contextmenu", callback);
                }
            }

            const classList = {
                add: function (cls) {
                    btn.classList.add(cls);
                },
                remove: function (cls) {
                    btn.classList.remove(cls);
                },
                setAll: function (cls) {
                    btn.classList = cls;
                }
            }

            _pointers[refid] = btn;
            return { innerText, remove, addEvent, classList, refid }
        }

        function button() {
            return noBoilerPlate("button");
        }

        function text() {
            return noBoilerPlate("p");
        }

        function deleteAll() {
            Object.values(_pointers).forEach(p => p.remove());
        }

        function getElementByPointer(id) {
            const el = _pointers[id];
            if (el) {
                return el;
            } else {
                return null;
            }
        }

        return {
            button, text, getElementByPointer, deleteAll
        }
    },
    window: function (title) {
        const newWin = this._internalCreate("div");
        newWin.style.position = "absolute";
        document.body.appendChild(newWin);
        let titleBar, content;

        function renderTitle() {
            titleBar = UI._internalCreate("div");
            titleBar.innerText = title;
            newWin.appendChild(titleBar);
        }

        function renderContent() {
            content = UI._internalCreate("div");
            newWin.appendChild(content);
        }

        renderTitle();
        renderContent();
        UI.registerDrag(newWin, titleBar);

        var scopeThis = {
            view: function () {
                const View = UI._internalCreate("div");
                newWin.appendChild(View);
                let UI2 = UI._exportUI(View);

                function add(element) {
                    if (element.refid) {
                        const elementPointer = UI2.getElementByPointer(element.refid);
                        View.appendChild(elementPointer);
                    }
                }

                function remove() {
                    View.remove();
                    UI2.deleteAll();
                    UI2 = undefined;
                }

                UI2["add"] = add;
                UI2["remove"] = remove;
                return UI2;
            }
        }

        return { view: scopeThis.view }
    },
}