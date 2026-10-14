(() => {
  if (!window.App.requireLogin()) return;
  const App = window.App;
  App.renderNavbar("bills.html");

  const $ = id => document.getElementById(id);
  const state = { bills: [], clients: [], billers: [], editing: false, originalBillNo: "" };
  const money = value => {
    const n = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => money(value).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
  const esc = App.escapeHTML;
  const showStatus = (id, message, kind="") => {
    const el=$(id); el.textContent=message; el.className="status"+(kind ? " "+kind : "");
  };
  const parseLeadingNumber = value => {
    const match=String(value ?? "").replace(/,/g,"").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  };
  const today = () => {
    const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const clientLabel = c => `${c.CompanyName || c["Company Name"] || c.Name || ""} [${c.Name || ""}]`;
  const billerLabel = b => `${b["Company Name"] || b.CompanyName || b.Name || ""} [${b.Name || ""}]`;

  async function api(action,payload={}) { return App.apiRequest(action,payload); }
  async function loadReferenceData() {
    const [clients,billers,bills] = await Promise.all([
      api("listClients"), api("listBillers"), api("listBills")
    ]);
    state.clients=clients.clients||[];
    state.billers=billers.billers||[];
    state.bills=bills.bills||[];
    $("clients-options").innerHTML=state.clients.map(c=>`<option value="${esc(clientLabel(c))}"></option>`).join("");
    $("billers-options").innerHTML=state.billers.map(b=>`<option value="${esc(billerLabel(b))}"></option>`).join("");
    renderBills();
  }
function sanitizeHtml(value) {
  return DOMPurify.sanitize(String(value || ""), {
    ALLOWED_TAGS: [
      "b", "strong", "i", "em", "u", "br",
      "p", "div", "span", "ul", "ol", "li"
    ],
    ALLOWED_ATTR: ["style"]
  });
}

  function resolveChoice(inputId, hiddenId, records, labelFn) {
    const text=$(inputId).value.trim();
    const match=records.find(r=>labelFn(r)===text);
    $(hiddenId).value=match ? String(match.Id||"") : "";
    return match || null;
  }
  $("client-search").addEventListener("input",()=>resolveChoice("client-search","client-id",state.clients,clientLabel));
  $("biller-search").addEventListener("input",()=>resolveChoice("biller-search","biller-id",state.billers,billerLabel));

  function renderBills() {
    const q=$("bill-search").value.trim().toLowerCase();
    const records=state.bills.filter(b=>{
      const c=state.clients.find(x=>String(x.Id)===String(b.ClientId));
      const bi=state.billers.find(x=>String(x.Id)===String(b.BillerId));
      return [b.BillNo,b.OrderNo,b.Date,clientLabel(c||{}),billerLabel(bi||{}),b.TotalAmount,b.GrandTotal].join(" ").toLowerCase().includes(q);
    }).sort((a,b)=>String(b.BillNo).localeCompare(String(a.BillNo),undefined,{numeric:true}));
    const tbody=$("bills-table-body");
    if(!records.length){tbody.innerHTML='<tr><td colspan="7" class="empty-row">No bills found. Click “New bill” to create one.</td></tr>';return;}
    tbody.innerHTML=records.map(b=>{
      const c=state.clients.find(x=>String(x.Id)===String(b.ClientId));
      const bi=state.billers.find(x=>String(x.Id)===String(b.BillerId));
      return `<tr>
        <td>${esc(b.BillNo)}</td><td>${esc(b.Date||"")}</td>
        <td>${esc(clientLabel(c||{Name:b.ClientId}))}</td><td>${esc(billerLabel(bi||{Name:b.BillerId}))}</td>
        <td>₹${fmt(b.TotalAmount)}</td><td>₹${fmt(b.GrandTotal)}</td>
        <td class="action-cell">
          <button class="button button-secondary button-small" data-action="view" data-bill="${esc(b.BillNo)}">⌕</button>
          <button class="button button-secondary button-small" data-action="edit" data-bill="${esc(b.BillNo)}">✎</button>
          <button class="button button-danger button-small" data-action="delete" data-bill="${esc(b.BillNo)}">⌫</button>
        </td></tr>`;
    }).join("");
  }
  $("bill-search").addEventListener("input",renderBills);
  $("bills-table-body").addEventListener("click",async e=>{
    const btn=e.target.closest("button[data-action]"); if(!btn)return;
    const billNo=btn.dataset.bill, action=btn.dataset.action;
    try {
      if(action==="delete"){
        if(!confirm(`Delete bill ${billNo} and all its particulars? This cannot be undone.`))return;
        await api("deleteBill",{billNo});
        state.bills=state.bills.filter(b=>String(b.BillNo)!==String(billNo));
        renderBills(); showStatus("page-status",`Bill ${billNo} deleted.`,"success");
      } else {
        const result=await api("getBill",{billNo});
        if(action==="view") await showInvoice(result.bill,result.particulars||[]);
        else openEditor(result.bill,result.particulars||[],false);
      }
    } catch(err){showStatus("page-status",err.message,"error");}
  });

  function openEditor(bill=null, particulars=[], readOnly=false) {
    state.editing=!!bill; state.originalBillNo=bill?String(bill.BillNo):"";
    $("invoice-view-panel").hidden=true;
    $("bill-form").reset();
    $("particulars-container").innerHTML="";
    $("original-bill-no").value=state.originalBillNo;
    $("editor-title").textContent=readOnly?`View bill ${bill.BillNo}`:(bill?"Edit bill":"Create bill");
    $("bill-no").value=bill?.BillNo || suggestBillNo();
    $("bill-no").readOnly=readOnly;
    $("order-no").value=bill?.OrderNo||"";
    $("site-address").value=bill?.SiteAddress||"";
    $("bill-date").value=bill?.Date||today();
    const c=state.clients.find(x=>String(x.Id)===String(bill?.ClientId));
    const bi=state.billers.find(x=>String(x.Id)===String(bill?.BillerId));
    $("client-search").value=c?clientLabel(c):"";
    $("client-id").value=bill?.ClientId||"";
    $("biller-search").value=bi?billerLabel(bi):"";
    $("biller-id").value=bill?.BillerId||"";
    $("total-amount").value=bill?.TotalAmount ?? "0";
    $("tax-enabled").checked=String(bill?.Tax).toLowerCase()==="true";
    $("tax-percentage").value=bill?.TaxPercentage ?? "18";
    const supply=String(bill?.InState).toLowerCase()==="true"?"InState":
      String(bill?.OutState).toLowerCase()==="true"?"OutState":"InState";
    document.querySelectorAll('input[name="supply-state"]').forEach(r=>r.checked=r.value===supply);
    $("cgst").value=bill?.CGST ?? "9"; $("sgst").value=bill?.SGST ?? "9"; $("igst").value=bill?.IGST ?? "18";
    $("cgst-amount").value=bill?.CGSTAmount ?? "0.00";
    $("sgst-amount").value=bill?.SGSTAmount ?? "0.00";
    $("igst-amount").value=bill?.IGSTAmount ?? "0.00";
    $("grand-total").value=bill?.GrandTotal ?? "0";
    $("amount-in-words").value=bill?.AmountInWords||"";
    if(particulars.length) particulars.forEach(p=>addParticular(p));
    else if(!bill) addParticular();
    toggleTaxFields();
    $("tax-enabled").dispatchEvent(new Event("change"));
    $("form-status").textContent="";
    $("bill-list-panel").hidden=true; $("bill-editor-panel").hidden=false;
    $("save-bill-button").hidden=readOnly;
    $("add-particular-button").hidden=readOnly;
    $("calculate-bill-button").hidden=readOnly;
    $("cancel-bill-button").hidden=readOnly;
    $("bill-form").querySelectorAll("input,textarea,button").forEach(el=>{
      if(el.id==="close-editor-button")return;
      if(el.id==="save-bill-button"||el.id==="cancel-bill-button"||el.id==="add-particular-button"||el.id==="calculate-bill-button")return;
      el.disabled=readOnly;
    });
    $("particulars-container").querySelectorAll("input,button,textarea").forEach(el=>el.disabled=readOnly);
    if(readOnly) {
      $("tax-enabled").disabled=true;
      $("editor-title").textContent=`View bill ${bill.BillNo}`;
    }
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function suggestBillNo(){
    let max=0;
    state.bills.forEach(b=>{const n=Number(String(b.BillNo).replace(/,/g,""));if(Number.isFinite(n))max=Math.max(max,n);});
    return String(max+1);
  }
  function closeEditor(){
    $("bill-editor-panel").hidden=true;$("invoice-view-panel").hidden=true;$("bill-list-panel").hidden=false;
    $("bill-no").readOnly=false;
    $("bill-form").querySelectorAll("input,textarea,button").forEach(el=>el.disabled=false);
    $("tax-enabled").disabled=false;
    $("save-bill-button").hidden=false;$("add-particular-button").hidden=false;$("calculate-bill-button").hidden=false;$("cancel-bill-button").hidden=false;
    renderBills();
  }
  function firstValue(record, keys, fallback="") {
    for (const key of keys) {
      const value = record?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
    }
    return fallback;
  }
  function displayDate(value) {
    const text=String(value||"").trim();
    const match=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
  }
  function invoiceDetailsHtml(particulars) {
    return particulars.map((p,index)=>{
      const details=Array.isArray(p.details)&&p.details.length?p.details:[{}];
      // Merge only consecutive identical rates; a repeated rate after a
      // different one is deliberately rendered as a separate cell.
      const rateGroups=[];
      details.forEach((detail,detailIndex)=>{
        const rate=String(detail.Rate||"").trim();
        const previous=rateGroups[rateGroups.length-1];
        if(previous && previous.rate===rate) previous.length++;
        else rateGroups.push({rate,start:detailIndex,length:1});
      });
      const rateGroupAtStart=new Map(rateGroups.map(group=>[group.start,group]));
      const titleRow=`<tr class="invoice-title-row">
        <td class="invoice-sno" rowspan="${details.length+1}">${index+1}.</td>
        <td class="invoice-particular"><strong>${esc(p.ParticularTitle||"")}</strong></td>
        <td class="invoice-hsn" rowspan="${details.length+1}">${esc(p["HSN Code"] || "")}</td>
        <td class="invoice-quantity" aria-hidden="true" style="border-bottom-color:#aaaaaa;"></td>
        <td class="invoice-rate" aria-hidden="true" style="border-bottom-color:#aaaaaa;"></td>
        <td class="invoice-amount" rowspan="${details.length+1}">₹ ${esc(fmt(p.Amount))}</td>
      </tr>`;
      const detailRows=details.map((d,detailIndex)=>{
        const rateGroup=rateGroupAtStart.get(detailIndex);
        const isLastDetail=detailIndex===details.length-1;
        const rateClass=rateGroup&&rateGroup.start+rateGroup.length===details.length
          ? "invoice-rate invoice-detail-final-rate"
          : "invoice-rate";
        return `<tr class="invoice-detail-row${isLastDetail?" invoice-detail-last-row":""}">
          <td class="invoice-particular"><div class="invoice-description">${esc(d.Description||"")}</div></td>
          <td class="invoice-quantity">${esc(d.Quantity||"")}</td>      
          ${rateGroup?`<td class="${rateClass}" rowspan="${rateGroup.length}">${esc(rateGroup.rate)}</td>`:""}
        </tr>`;
      }).join("");
      return titleRow+detailRows;
    }).join("");
  }
  function invoiceTaxRows(bill) {
    const enabled=String(bill.Tax).toLowerCase()==="true";
    const inState=String(bill.InState).toLowerCase()==="true";
    const outState=String(bill.OutState).toLowerCase()==="true";
    let html="";
    if(enabled&&inState){
      html+=`<tr class="invoice-total-row"><td colspan="5" class="invoice-total-label">Add CGST @ ${esc(bill.CGST||0)}% ₹</td><td class="invoice-total-value">${esc(fmt(bill.CGSTAmount))}</td></tr>`;
      html+=`<tr class="invoice-total-row"><td colspan="5" class="invoice-total-label">Add SGST @ ${esc(bill.SGST||0)}% ₹</td><td class="invoice-total-value">${esc(fmt(bill.SGSTAmount))}</td></tr>`;
    }
    if(enabled&&outState){
      html+=`<tr class="invoice-total-row"><td colspan="5" class="invoice-total-label">Add IGST @ ${esc(bill.IGST||bill.TaxPercentage||0)}% ₹</td><td class="invoice-total-value">${esc(fmt(bill.IGSTAmount))}</td></tr>`;
    }
    return html;
  }
  async function showInvoice(bill, particulars) {
    // Refresh reference records at view time and resolve by the stored IDs.
    showStatus("page-status","Loading client and biller details…");
    const [clientsResponse,billersResponse]=await Promise.all([api("listClients"),api("listBillers")]);
    const clients=clientsResponse.clients||[];
    const billers=billersResponse.billers||[];
    state.clients=clients;
    state.billers=billers;
    const client=clients.find(c=>String(c.Id)===String(bill.ClientId))||state.clients.find(c=>String(c.Id)===String(bill.ClientId))||{};
    const biller=billers.find(b=>String(b.Id)===String(bill.BillerId))||state.billers.find(b=>String(b.Id)===String(bill.BillerId))||{};
    const clientName=firstValue(client,["CompanyName","Company Name","Name"],String(bill.ClientId||""));
    const billerName=firstValue(biller,["Company Name","CompanyName","Name"],String(bill.BillerId||""));
    const gstin=firstValue(biller,["GSTIN","GST","GST No","GSTIN No."]);
    const pan=firstValue(biller,["PAN","PAN NO.","PAN No"]);
    const phone=firstValue(biller,["Phone","Mobile","Phone Number"]);
    const altPhone=firstValue(biller,["Alt.Phone","Alt Phone","Alternate Phone","Alternate Phone Number"]);
    const billerDescription=firstValue(biller,["Description"]);
    const billerAddress=firstValue(biller,["Address"]);
    const clientAddress=firstValue(client,["Address","Company Address"]);
    const clientGst=firstValue(client,["GSTIN","GST","GST No","GSTIN No."]);
    const amountWords=firstValue(bill,["AmountInWords"]);
    const siteAddress=firstValue(bill,["SiteAddress"]);
    const html=`<div class="invoice-topline">
        <div><div>GSTIN: ${esc(gstin)}</div><div>PAN NO.: ${esc(pan)}</div></div>
        <div class="invoice-title">TAX INVOICE</div>
        <div class="invoice-phone"><div>Mob.: ${esc(phone)}</div><div>${esc(altPhone)}</div></div>
      </div>
      <header class="invoice-company">
        <h1>${esc(billerName)}</h1>
        ${billerDescription?`<p>${sanitizeHtml(billerDescription)}</p>`:""}
        ${billerAddress?`<p class="invoice-company-address">${sanitizeHtml(billerAddress)}</p>`:""}
      </header>
      <section class="invoice-party-grid">
        <div class="invoice-client-details">
          <p><strong>Name:</strong> ${esc(clientName)}</p>
          <p><strong>Address:</strong> ${esc(clientAddress)}</p>
          ${siteAddress?`<p><strong>Site Address:</strong> ${esc(siteAddress)}</p>`:""}
          <p><strong>GSTIN No.:</strong> ${esc(clientGst)}</p>
        </div>
        <div class="invoice-bill-meta">
          <p><strong>Bill No.</strong> ${esc(bill.BillNo||"")}</p>
          <p><strong>Order No.</strong> ${esc(bill.OrderNo||"")}</p>
          <p class="invoice-date"><strong>Date:</strong> ${esc(displayDate(bill.Date))}</p>
        </div>
      </section>
      <table class="invoice-table">
        <thead><tr><th>S.No.</th><th>Particulars</th><th>HSN<br>code</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>${invoiceDetailsHtml(particulars)}
          <tr class="invoice-total-row"><td></td><td colspan="4" class="invoice-total-label">Total Amount ₹</td><td class="invoice-total-value">${esc(fmt(bill.TotalAmount))}</td></tr>
          ${invoiceTaxRows(bill)}
       
<tr class="invoice-words-grand-row">
  <td colspan="4" class="invoice-words-cell">
    <strong>Rupees:</strong>
    ${esc(amountWords || "")}
  </td>
  <td class="invoice-total-label invoice-grand-label">Grand Total ₹</td>
  <td class="invoice-total-value invoice-grand-value">
    ${esc(fmt(bill.GrandTotal))}
  </td>
</tr>



<tr class="invoice-footer-container-row">
  <td colspan="6">
    <div class="invoice-footer-container">
      <div class="invoice-footer-top-left"><b>E. &amp; O.E.</b></div>

      <div class="invoice-footer-top-right">
        <b>For ${esc(billerName)}</b>
      </div>

      <div class="invoice-footer-bottom-left">
        <strong>Terms &amp; Conditions:</strong>
        <br>
        All disputes subject to Delhi Jurisdiction only.
      </div>

      <div class="invoice-footer-bottom-right">
        Authorized Signatory
      </div>
    </div>
  </td>
</tr>


        </tbody>
      </table>`;
    $("invoice-document").innerHTML=html;
    $("invoice-view-title").textContent=`View bill ${bill.BillNo}`;
    $("bill-list-panel").hidden=true;
    $("bill-editor-panel").hidden=true;
    $("invoice-view-panel").hidden=false;
    showStatus("page-status","");
    showStatus("invoice-status","");
    state.viewBillNo=String(bill.BillNo||"");
    state.viewInvoice=true;
    window.scrollTo({top:0,behavior:"smooth"});
  }
  $("back-from-invoice-button").addEventListener("click",()=>{
    $("invoice-view-panel").hidden=true;
    $("bill-list-panel").hidden=false;
    state.viewInvoice=false;
    renderBills();
  });
  $("download-invoice-button").addEventListener("click",async()=>{
    if(!window.html2pdf){showStatus("invoice-status","PDF generator did not load. Check your internet connection and reload the page.","error");return;}
    const button=$("download-invoice-button");
    button.disabled=true;button.textContent="Generating PDF…";
    try{
      const element=$("invoice-document");
      const filename=`Bill-${String(state.viewBillNo||"invoice").replace(/[^a-zA-Z0-9_-]/g,"_")}.pdf`;
      await window.html2pdf().set({
        margin:[5,5,5,5],filename,
        image:{type:"jpeg",quality:0.98},
        html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",scrollY:0},
        jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},
        pagebreak:{mode:["css","legacy"]}
      }).from(element).save();
      showStatus("invoice-status","PDF downloaded.","success");
    }catch(err){showStatus("invoice-status",`Could not generate PDF: ${err.message||err}`,"error");}
    finally{button.disabled=false;button.textContent="Download PDF";}
  });

  $("new-bill-button").addEventListener("click",()=>openEditor());
  $("close-editor-button").addEventListener("click",closeEditor);
  $("cancel-bill-button").addEventListener("click",closeEditor);
  $("add-particular-button").addEventListener("click",()=>addParticular());

  function addParticular(data={}) {
    const container=$("particulars-container");
    const index=container.querySelectorAll(".particular-card").length;
    const card=document.createElement("section"); card.className="particular-card";
    const displaySNo=data.SNo ?? (index+1);
    card.dataset.sno=displaySNo;
    card.innerHTML=`
      <div class="particular-head">
        <div class="field-group"><label>Particular title</label><input class="particular-title" maxlength="250" required value="${esc(data.ParticularTitle||"")}"></div>
        <div class="field-group"><label>SNo (auto)</label><input class="particular-sno" value="${esc(displaySNo)}" readonly></div>
        <div class="field-group"><label>HSN Code</label> <input class="particular-hsn" maxlength="80" value="${esc(data["HSN Code"] || "")}"></div>
        <div class="particular-remove"><button type="button" class="button button-danger button-small remove-particular">Remove particular</button></div>
        <div class="field-group"><label>Particular amount (editable)</label><input class="particular-amount" inputmode="decimal" value="${esc(data.Amount??"0")}"></div>
        <div class="row-actions"><button type="button" class="button button-secondary button-small calculate-particular">Calculate amount</button><button type="button" class="button button-secondary button-small add-detail">+ Add detail row</button></div>
      </div>
      <div class="detail-heading">Detail rows</div><div class="details-container"></div>`;
    container.appendChild(card);
    const details=card.querySelector(".details-container");
    if(data.details?.length) data.details.forEach(d=>addDetail(details,d));
    else addDetail(details);
    card.querySelector(".remove-particular").addEventListener("click",()=>{card.remove();renumberParticulars();});
    card.querySelector(".add-detail").addEventListener("click",()=>addDetail(details));
    card.querySelector(".calculate-particular").addEventListener("click",()=>calculateParticular(card));
  }
  function renumberParticulars(){
    [...$("particulars-container").querySelectorAll(".particular-card")].forEach((card,i)=>{
      card.dataset.sno=i+1;card.querySelector(".particular-sno").value=i+1;
    });
  }
  function addDetail(container,data={}) {
    const row=document.createElement("div");row.className="detail-row";
    row.innerHTML=`
      <div class="field-group"><label>Description</label><input class="detail-description" maxlength="1000" value="${esc(data.Description||"")}"></div>
      <div class="field-group"><label>Quantity</label><input class="detail-quantity" placeholder="e.g. 5.2 trips" value="${esc(data.Quantity||"")}"></div>      
      <div class="field-group"><label>Rate</label><input class="detail-rate" placeholder="e.g. Rs. 6,000/trip" value="${esc(data.Rate||"")}"></div>
      <div class="row-actions"><button type="button" class="button button-danger button-small remove-detail">Remove</button></div>`;
    container.appendChild(row);
    row.querySelector(".remove-detail").addEventListener("click",()=>row.remove());
  }
  function calculateParticular(card){
    const amount=[...card.querySelectorAll(".detail-row")].reduce((sum,row)=>
      sum+parseLeadingNumber(row.querySelector(".detail-quantity").value)*parseLeadingNumber(row.querySelector(".detail-rate").value),0);
    card.querySelector(".particular-amount").value=amount.toFixed(2);
  }
  $("calculate-bill-button").addEventListener("click",()=>{
    const total=[...$("particulars-container").querySelectorAll(".particular-amount")].reduce((sum,input)=>sum+money(input.value),0);
    $("total-amount").value=total.toFixed(2);calculateGrandTotal();
  });
  const stateRadios=[...document.querySelectorAll('input[name="supply-state"]')];
  function toggleTaxFields(){
    const enabled=$("tax-enabled").checked;
    $("tax-fields").hidden=!enabled;
    const selected=stateRadios.find(r=>r.checked)?.value||"InState";
    $("in-state-fields").hidden=!enabled||selected!=="InState";
    $("out-state-fields").hidden=!enabled||selected!=="OutState";
    if(enabled && selected==="InState"){
      const total=money($("tax-percentage").value);
      if(document.activeElement!==$("cgst"))$("cgst").value=(total/2).toFixed(2);
      if(document.activeElement!==$("sgst"))$("sgst").value=(total/2).toFixed(2);
    } else if(enabled && selected==="OutState" && document.activeElement!==$("igst")) {
      $("igst").value=money($("tax-percentage").value).toFixed(2);
    }
    calculateTaxAmounts();
  }
  function calculateTaxAmounts(){
    const total=money($("total-amount").value);
    const enabled=$("tax-enabled").checked;
    const selected=stateRadios.find(r=>r.checked)?.value||"InState";
    $("cgst-amount").value=(enabled&&selected==="InState"?total*money($("cgst").value)/100:0).toFixed(2);
    $("sgst-amount").value=(enabled&&selected==="InState"?total*money($("sgst").value)/100:0).toFixed(2);
    $("igst-amount").value=(enabled&&selected==="OutState"?total*money($("igst").value)/100:0).toFixed(2);
  }
  $("tax-enabled").addEventListener("change",()=>{toggleTaxFields();calculateGrandTotal();});
  stateRadios.forEach(r=>r.addEventListener("change",()=>{toggleTaxFields();calculateGrandTotal();}));
  $("tax-percentage").addEventListener("input",()=>{toggleTaxFields();calculateGrandTotal();});
  ["cgst","sgst","igst","total-amount"].forEach(id=>$(id).addEventListener("input",calculateGrandTotal));
  $("grand-total").addEventListener("input",()=>{$("amount-in-words").dataset.userEdited="true";});
  function calculateGrandTotal(){
    const total=money($("total-amount").value);
    let grand=total;
    calculateTaxAmounts();
    if($("tax-enabled").checked){
      const selected=stateRadios.find(r=>r.checked)?.value;
      const taxAmount=selected==="InState"
        ? money($("cgst-amount").value)+money($("sgst-amount").value)
        : money($("igst-amount").value);
      grand+=taxAmount;
    }
    $("grand-total").value=grand.toFixed(2);
    if(!$("amount-in-words").dataset.userEdited || !$("amount-in-words").value.trim())
      $("amount-in-words").value=numberToIndianWords(Math.round(grand))+" Rupees Only";
  }
  $("amount-in-words").addEventListener("input",()=>{$("amount-in-words").dataset.userEdited="true";});
  function numberToIndianWords(num){
    if(!Number.isFinite(num)||num<0)return "";
    if(num===0)return "Zero";
    const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
    const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
    const under100=n=>n<20?ones[n]:tens[Math.floor(n/10)]+(n%10?" "+ones[n%10]:"");
    const under1000=n=>(n>=100?ones[Math.floor(n/100)]+" Hundred"+(n%100?" ":""):"")+(n%100?under100(n%100):"");
    let n=Math.floor(num),parts=[];
    for(const [value,name] of [[10000000,"Crore"],[100000,"Lakh"],[1000,"Thousand"],[100,"Hundred"]]){
      if(n>=value){const count=Math.floor(n/value);parts.push(value===100?ones[count]+" "+name:under1000(count)+" "+name);n%=value;}
    }
    if(n)parts.push(under1000(n));
    return parts.join(" ");
  }

  $("bill-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const client=resolveChoice("client-search","client-id",state.clients,clientLabel);
    const biller=resolveChoice("biller-search","biller-id",state.billers,billerLabel);
    if(!client){showStatus("form-status","Select a client from the suggestion list.","error");return;}
    if(!biller){showStatus("form-status","Select a biller from the suggestion list.","error");return;}
    const billNo=$("bill-no").value.trim();
    if(!billNo){showStatus("form-status","Bill number is required.","error");return;}
    const tax=$("tax-enabled").checked, supply=stateRadios.find(r=>r.checked)?.value||"InState";
    const particulars=[...$("particulars-container").querySelectorAll(".particular-card")].map((card,i)=>({
      ParticularTitle:card.querySelector(".particular-title").value.trim(),
      SNo:i+1,
      "HSN Code": card.querySelector(".particular-hsn").value.trim(),
      Amount:String(money(card.querySelector(".particular-amount").value)),
      details:[...card.querySelectorAll(".detail-row")].map(row=>({
        Description:row.querySelector(".detail-description").value.trim(),
        Quantity:row.querySelector(".detail-quantity").value.trim(),
        Rate:row.querySelector(".detail-rate").value.trim()
      }))
    }));
    if(!particulars.length){showStatus("form-status","Add at least one particular.","error");return;}
    if(particulars.some(p=>!p.ParticularTitle)){showStatus("form-status","Every particular needs a title.","error");return;}
    const bill={
      ClientId:client.Id, BillerId:biller.Id, BillNo:billNo, OrderNo:$("order-no").value.trim(),
      SiteAddress:$("site-address").value.trim(), Date:$("bill-date").value, TotalAmount:String(money($("total-amount").value)),
      AmountInWords:$("amount-in-words").value.trim(), Tax:tax,
      TaxPercentage:tax?String(money($("tax-percentage").value)):null,
      InState:tax?supply==="InState":null, OutState:tax?supply==="OutState":null,
      CGST:tax&&supply==="InState"?String(money($("cgst").value)):null,
      SGST:tax&&supply==="InState"?String(money($("sgst").value)):null,
      IGST:tax&&supply==="OutState"?String(money($("igst").value)):null,
      CGSTAmount:tax&&supply==="InState"?String(money($("cgst-amount").value)):null,
      SGSTAmount:tax&&supply==="InState"?String(money($("sgst-amount").value)):null,
      IGSTAmount:tax&&supply==="OutState"?String(money($("igst-amount").value)):null,
      GrandTotal:String(money($("grand-total").value))
    };
    const save=$("save-bill-button");save.disabled=true;
    showStatus("form-status","Saving bill…");
    try{
      await api("saveBill",{originalBillNo:state.originalBillNo||null,data:{bill,particulars}});
      showStatus("page-status",`Bill ${billNo} saved successfully.`,"success");
      closeEditor();await loadReferenceData();
    }catch(err){showStatus("form-status",err.message,"error");}
    finally{save.disabled=false;}
  });

  // Reset read-only state when creating/editing after viewing.
  const originalOpenEditor=openEditor;
  // The openEditor routine above sets read-only controls only for view; this helper restores all controls on next edit.
  const observer=new MutationObserver(()=>{});
  $("bill-list-panel").hidden=false;
  (async()=>{
    try{await loadReferenceData();}
    catch(err){showStatus("page-status",err.message,"error");$("bills-table-body").innerHTML='<tr><td colspan="7" class="empty-row">Could not load bills. Confirm the Apps Script actions and sheet headers are installed.</td></tr>';}
  })();
})();
