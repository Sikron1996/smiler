import { ethers } from "https://esm.sh/ethers@6.13.4";
import EthereumProvider from "https://esm.sh/@walletconnect/ethereum-provider@2.17.2";

const CONTRACT_ADDRESS = "0xdb5Ff2979dF69Cce188EAebfe17dD067d083561C";
const PROJECT_ID = "fe55ea601c3e7e0925c0b33723d6b158";
const READ_RPC = "https://ethereum.publicnode.com";

const ABI = [
  "function mint(uint256 amount) external payable",
  "function freeMint() external",
  "function PRICE() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function freeMintUsed(address user) view returns (bool)"
];

let provider, signer, contract;
let readProvider, readContract;
let account, wcProvider;

const $ = (id) => document.getElementById(id);
const modal = $("walletModal");

function text(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function status(m) {
  text("status", m);
}

function openModal() {
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

function amount() {
  let v = Number($("amount").value);
  if (!v || v < 1) v = 1;
  if (v > 100) v = 100;
  $("amount").value = v;
  return v;
}

function initRead() {
  readProvider = new ethers.JsonRpcProvider(READ_RPC);
  readContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, readProvider);

  const link = $("etherscanLink");
  if (link) link.href = "https://etherscan.io/address/" + CONTRACT_ADDRESS;

  return true;
}

async function loadSupply() {
  try {
    if (!readContract) initRead();

    const supply = await readContract.totalSupply();
    text("mintedText", Number(supply).toLocaleString());
  } catch (e) {
    status("Read error: " + (e.shortMessage || e.message));
  }
}

async function updatePrice() {
  try {
    const price = await readContract.PRICE();
    const qty = BigInt(amount());
    const total = price * qty;

    text("totalPrice", ethers.formatEther(total) + " ETH");
  } catch (e) {
    status("Price error: " + (e.shortMessage || e.message));
  }
}

async function setup(wp, acc) {
  provider = new ethers.BrowserProvider(wp);
  signer = await provider.getSigner();

  account = acc || await signer.getAddress();

  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  text("wallet", account.slice(0, 6) + "..." + account.slice(-4));
  text("topConnect", account.slice(0, 6) + "..." + account.slice(-4));

  $("connectBtn").style.display = "none";
  $("mintBtn").style.display = "block";

  closeModal();
  await loadSupply();
}

async function connectBrowser() {
  try {
    if (!window.ethereum) throw new Error("Wallet not found");

    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== "0x1") {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }]
      });
    }

    const acc = await window.ethereum.request({
      method: "eth_requestAccounts"
    });

    await setup(window.ethereum, acc[0]);
  } catch (e) {
    status("Error: " + (e.shortMessage || e.message));
  }
}

async function connectWC() {
  try {
    wcProvider = await EthereumProvider.init({
      projectId: PROJECT_ID,
      chains: [1],
      showQrModal: true
    });

    await wcProvider.connect();
    await setup(wcProvider, wcProvider.accounts?.[0]);
  } catch (e) {
    status("Error: " + (e.shortMessage || e.message));
  }
}

async function mint() {
  try {
    if (!contract) {
      openModal();
      return;
    }

    const qty = BigInt(amount());
    const price = await readContract.PRICE();

    const value = price * qty;

    status("Confirm mint...");

    const tx = await contract.mint(qty, { value });

    status("Tx: " + tx.hash);

    await tx.wait();

    status("Mint success");

    await loadSupply();
  } catch (e) {
    status("Error: " + (e.shortMessage || e.message));
  }
}

async function freeMint() {
  try {
    if (!contract) {
      openModal();
      return;
    }

    status("Confirm free mint...");

    const tx = await contract.freeMint();

    status("Tx: " + tx.hash);

    await tx.wait();

    status("Free mint success");

    await loadSupply();
  } catch (e) {
    status("Error: " + (e.shortMessage || e.message));
  }
}

/* EVENTS */
$("topConnect").onclick = openModal;
$("connectBtn").onclick = openModal;
$("closeModalBtn").onclick = closeModal;

$("browserWalletBtn").onclick = connectBrowser;
$("walletConnectBtn").onclick = connectWC;

$("mintBtn").onclick = mint;
$("freeMintBtn").onclick = freeMint;

$("minus").onclick = async () => {
  $("amount").value = Math.max(1, amount() - 1);
  await updatePrice();
};

$("plus").onclick = async () => {
  $("amount").value = Math.min(100, amount() + 1);
  await updatePrice();
};

$("amount").oninput = updatePrice;

/* INIT */
initRead();
loadSupply();
updatePrice();
