console.time("DOM buttons");

let ct2 = 0;
while (ct2 < 3000) {
    ct2++;
    const btn = document.createElement("button");
    btn.innerText = "click me";
    document.body.appendChild(btn);
    btn.addEventListener("mouseover", function () {
        btn.style.background = "#000";
        btn.style.color = "#fff";
    })
}

console.timeEnd("DOM buttons");