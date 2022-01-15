import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { contractABI, contractAddress } from "../Utils/constants";

export const TransactionContext = React.createContext();

const { ethereum } = window; //entire window object to handle our smartcontract and blockchain relation, and we have this due to metamask extension

const createEthereumContract = () => {
  const provider = new ethers.providers.Web3Provider(ethereum);
  const signer = provider.getSigner();
  const transactionContract = new ethers.Contract( //fetching our contract
    contractAddress,
    contractABI,
    signer
  );

  console.log({ provider, signer, transactionContract });
  return transactionContract;
};

export const TransactionProvider = ({ children }) => {
  const [currentAccount, setCurrentAccount] = useState("");
  const [formData, setFormData] = useState({
    addressTo: "",
    amount: "",
    keyword: "",
    message: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [transactionCount, setTransactionCount] = useState(
    localStorage.getItem("transactionCount")
  );
  const [transactions, setTransactions] = useState([]);

  const handleChange = (e, name) => {
    setFormData((prev) => ({ ...prev, [name]: e.target.value }));
  };

  const getAllTransactions = async () => {
    try {
      if (ethereum) {
        const transactionContract = createEthereumContract();

        const availableTransactions =
          await transactionContract.getAllTransactions();

        const structeredTransactions = availableTransactions.map(
          (transaction) => ({
            addressTo: transaction.reciever,
            addressFrom: transaction.sender,
            timestamp: new Date(
              transaction.timestamp.toNumber() * 1000
            ).toLocaleString(),
            message: transaction.message,
            keyword: transaction.keyword,
            amount: parseInt(transaction.amount._hex) / 10 ** 18, //this amount is in ethereum gwei, to convert it we need to multiply it by 10^18
          })
        );

        setTransactions(structeredTransactions);
      } else {
        console.log("ethereum is not found");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const checkIfWalletIsConnected = async () => {
    try {
      if (!ethereum) return alert("Please install metamask!");
      const accounts = await ethereum.request({ method: "eth_accounts" });

      if (accounts.length) {
        setCurrentAccount(accounts[0]);

        getAllTransactions();
      } else {
        console.log("No accounts found");
      }
    } catch (e) {
      console.log(e);
      throw new Error("No Etherium Object.");
    }
  };

  const checkIfTransactionsExist = async () => {
    try {
      const transactionContract = createEthereumContract();
      const currentTransactionCount =
        await transactionContract.getTransactionCount();
      console.log(currentTransactionCount);
      window.localStorage.setItem("transactionCount", currentTransactionCount);
    } catch (error) {
      console.log(error.message);
      throw new Error("No Etherium Object.");
    }
  };

  const connectWallet = async () => {
    try {
      if (!ethereum) return alert("Please install metamask!");
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      setCurrentAccount(accounts[0]);
    } catch (e) {
      console.log(e);
      throw new Error("No Etherium Object.");
    }
  };

  const sendTransaction = async () => {
    try {
      if (!ethereum) return alert("Please install metamask!");

      const { addressTo, amount, keyword, message } = formData;
      const transactionContract = createEthereumContract();
      const parsedAmount = ethers.utils.parseEther(amount); //parses decimal amount into GWEI hexadecimal amount

      //sending ethereum from one address to another
      await ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: currentAccount,
            to: addressTo,
            gas: "0x5208", //21000 gwei
            value: parsedAmount._hex, //we need to convert this amount to gwei
          },
        ],
      });

      const transactionHash = await transactionContract.addToBlockChain(
        //transactionHash is a transaction id
        addressTo,
        parsedAmount,
        message,
        keyword
      );
      setIsLoading(true);
      console.log(`Loading - ${transactionHash.hash}`);

      await transactionHash.wait();
      setIsLoading(false);
      console.log(`Success - ${transactionHash.hash}`);

      const transactionCount = await transactionContract.getTransactionCount();
      setTransactionCount(transactionCount.toNumber());

      location.reload();
    } catch (error) {
      console.log(error);
      throw new Error("No Etherium Object.");
    }
  };

  useEffect(() => {
    checkIfWalletIsConnected();
    checkIfTransactionsExist();
  }, []);

  return (
    <TransactionContext.Provider
      value={{
        connectWallet,
        currentAccount,
        formData,
        setFormData,
        isLoading,
        handleChange,
        sendTransaction,
        transactions,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};
