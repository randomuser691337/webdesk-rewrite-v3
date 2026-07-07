const UIState = {
    windowArray: []
}

var UI = {
    registerDrag: function (elmnt, dragHandle) {
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
    window: function (title) {
        const newWin = this._internalCreate("div");
        newWin.classList = "window";
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

        return { titleBar, content, DOMel: newWin }
    },
    view: function (id) {
        const div = this._internalCreate("div");
        return div;
    },
    button: function (id) {
        const btn = this._internalCreate("button");

        function updateComponent(data) {
            if (data.text) btn.innerText = data.text;
        }

        return { DOMel: btn, updateComponent };
    },
    text: function (id) {
        const p = this._internalCreate("p");
        return p;
    }
}