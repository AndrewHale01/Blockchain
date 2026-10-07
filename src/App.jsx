import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import lotteryArtifact from "../build/contracts/Lottery.json";

const injectedEthereum = () => window.ethereum;

function shortenedAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function errorMessage(error) {
  return error?.shortMessage || error?.reason || error?.message || "Сталася невідома помилка.";
}

export default function App() {
  const [account, setAccount] = useState("");
  const [lottery, setLottery] = useState(null);
  const [lotteryAddress, setLotteryAddress] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [manager, setManager] = useState("");
  const [players, setPlayers] = useState([]);
  const [balance, setBalance] = useState("0");
  const [entryFee, setEntryFee] = useState("0.01");
  const [lastWinner, setLastWinner] = useState("");
  const [currentRound, setCurrentRound] = useState("1");
  const [hasEntered, setHasEntered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refreshLottery = useCallback(async () => {
    const ethereum = injectedEthereum();
    if (!ethereum) return;

    const provider = new BrowserProvider(ethereum);
    const [chainId, accounts] = await Promise.all([
      provider.send("net_version", []),
      ethereum.request({ method: "eth_accounts" }),
    ]);
    const address =
      import.meta.env.VITE_LOTTERY_ADDRESS ||
      lotteryArtifact.networks?.[chainId]?.address;

    setNetworkId(chainId);
    setAccount(accounts[0] || "");

    if (!address) {
      setLottery(null);
      setLotteryAddress("");
      setPlayers([]);
      setBalance("0");
      setManager("");
      setHasEntered(false);
      return;
    }

    const contract = new Contract(address, lotteryArtifact.abi, provider);
    const [owner, entrants, last, round, fee, amount] = await Promise.all([
      contract.manager(),
      contract.getPlayers(),
      contract.lastWinner(),
      contract.currentRound(),
      contract.ENTRY_FEE(),
      provider.getBalance(address),
    ]);
    const activeAccount = accounts[0] || "";

    setLottery(contract);
    setLotteryAddress(address);
    setManager(owner);
    setPlayers(entrants);
    setLastWinner(last);
    setCurrentRound(round.toString());
    setEntryFee(formatEther(fee));
    setBalance(formatEther(amount));
    setHasEntered(
      activeAccount ? await contract.hasEntered(activeAccount) : false,
    );
  }, []);

  useEffect(() => {
    const ethereum = injectedEthereum();
    if (!ethereum) return undefined;

    const handleWalletChange = () => {
      refreshLottery().catch((reason) => setError(errorMessage(reason)));
    };

    handleWalletChange();
    ethereum.on("accountsChanged", handleWalletChange);
    ethereum.on("chainChanged", handleWalletChange);

    return () => {
      ethereum.removeListener("accountsChanged", handleWalletChange);
      ethereum.removeListener("chainChanged", handleWalletChange);
    };
  }, [refreshLottery]);

  async function connectWallet() {
    const ethereum = injectedEthereum();
    if (!ethereum) {
      setError("Для роботи застосунку встановіть MetaMask.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      await refreshLottery();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function joinLottery() {
    if (!lottery || !account) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const provider = new BrowserProvider(injectedEthereum());
      const signer = await provider.getSigner();
      const transaction = await lottery.connect(signer).enter({
        value: parseEther(entryFee),
      });
      setNotice("Транзакцію надіслано. Очікуємо підтвердження…");
      await transaction.wait();
      setNotice("Ви успішно приєдналися до лотереї!");
      await refreshLottery();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function pickWinner() {
    if (!lottery || !account) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const provider = new BrowserProvider(injectedEthereum());
      const signer = await provider.getSigner();
      const transaction = await lottery.connect(signer).pickWinner();
      setNotice("Розіграш надіслано. Очікуємо підтвердження…");
      await transaction.wait();
      setNotice("Переможця визначено, приз виплачено!");
      await refreshLottery();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function refreshBalance() {
    setError("");
    try {
      await refreshLottery();
      setNotice("Баланс лотереї оновлено.");
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  const isManager =
    account && manager && account.toLowerCase() === manager.toLowerCase();
  const deployed = Boolean(lottery);

  return (
    <main className="page">
      <header className="header">
        <h1>Лотерея</h1>
        <button onClick={connectWallet} disabled={busy} type="button">
          {account ? shortenedAddress(account) : "Підключити гаманець"}
        </button>
      </header>

      {!deployed && (
        <p className="message" role="status">
          Контракт не знайдено в цій мережі. Підключіться до Ganache та розгорніть
          контракт командою{" "}
          <code>truffle migrate --network development</code>.
          {networkId && ` Поточний ID мережі: ${networkId}.`}
        </p>
      )}

      {(notice || error) && (
        <p className={`message ${error ? "error" : ""}`} role="status">
          {error || notice}
        </p>
      )}

      <section className="details" aria-label="Інформація про лотерею">
        <p><strong>Баланс:</strong> {balance} ETH</p>
        <p><strong>Вартість участі:</strong> {entryFee} ETH</p>
        <p><strong>Учасників:</strong> {players.length}</p>
        <p><strong>Раунд:</strong> {currentRound}</p>
        <p>
          <strong>Останній переможець:</strong>{" "}
          {lastWinner && lastWinner !== "0x0000000000000000000000000000000000000000"
            ? shortenedAddress(lastWinner)
            : "ще не визначений"}
        </p>
        {account && (
          <p><strong>Ваш гаманець:</strong> {shortenedAddress(account)}</p>
        )}
      </section>

      <section className="actions" aria-label="Дії лотереї">
        <button
          onClick={joinLottery}
          disabled={!deployed || !account || hasEntered || busy}
          type="button"
        >
          {busy ? "Зачекайте…" : hasEntered ? "Ви вже приєдналися" : "Приєднатися"}
        </button>
        <button
          onClick={pickWinner}
          disabled={!deployed || !isManager || players.length === 0 || busy}
          title={!isManager ? "Визначити переможця може лише власник контракту" : ""}
          type="button"
        >
          Визначити переможця
        </button>
        <button
          onClick={refreshBalance}
          disabled={!deployed || busy}
          type="button"
        >
          Оновити баланс лотереї
        </button>
      </section>
    </main>
  );
}
