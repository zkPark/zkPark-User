import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
  Linking,
} from "react-native";

import { supabase } from "../supabaseAccess";

import { FontAwesome, FontAwesome5, Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import Toast from "react-native-toast-message";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

// Interface for Ethereum window object
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (request: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

const WalletPage = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [connectingWallet, setConnectingWallet] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Fetch the user's wallet details from Supabase
  const fetchWalletDetails = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not logged in");
      }

      // Store the user's email for later use
      setUserEmail(user.email || null);

      const { data, error: fetchError } = await supabase
        .from("user")
        .select("wallet_addr")
        .eq("email_id", user.email)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // If wallet details exist, set them in state
      if (data) {
        setWalletAddress(data.wallet_addr);
      }
    } catch (error) {
      console.error("Error fetching wallet details:", error);
      setError("Failed to fetch wallet details.");
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to fetch wallet details.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Update wallet address in Supabase
  const updateWalletAddress = async (address: string | null) => {
    try {
      if (!userEmail) {
        throw new Error("User email not found");
      }

      console.log("Updating wallet address in Supabase:", address);
      console.log("For user email:", userEmail);

      // Update the wallet_addr field in the user table for this user
      const { error } = await supabase
        .from("user")
        .update({ wallet_addr: address })
        .eq("email_id", userEmail);

      if (error) {
        console.error("Supabase update error:", error);
        throw error;
      }

      console.log("Wallet address updated successfully in Supabase");

      // Update local state
      setWalletAddress(address);

      if (address) {
        Toast.show({
          type: "success",
          text1: "Success",
          text2: "MetaMask wallet connected successfully.",
        });
      } else {
        Toast.show({
          type: "success",
          text1: "Success",
          text2: "Wallet disconnected successfully.",
        });
      }
    } catch (error) {
      console.error("Error updating wallet address:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to update wallet address.",
      });
    }
  };

  // Handle manual wallet connection
  const manuallyConnectWallet = () => {
    Alert.prompt(
      "Enter Wallet Address",
      "Please paste your MetaMask wallet address:",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Connect",
          onPress: async (address) => {
            if (address && address.startsWith("0x")) {
              // Store exactly what the user entered to Supabase
              await updateWalletAddress(address);
            } else {
              Alert.alert(
                "Invalid Address",
                "Please enter a valid Ethereum address starting with 0x"
              );
            }
          },
        },
      ]
    );
  };

  // Handle disconnect wallet
  const disconnectWallet = async () => {
    try {
      await updateWalletAddress(null);
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to disconnect wallet. Please try again.",
      });
    }
  };

  // Connect MetaMask wallet - simplified for mobile to just open MetaMask 
  // and then prompt for manual address entry
  const connectMetaMask = async () => {
    try {
      setConnectingWallet(true);

      // Web environment with MetaMask
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        window.ethereum?.isMetaMask
      ) {
        // Request account access
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });

        // Get the first account
        const address = accounts[0];
        await updateWalletAddress(address);
      }
      // Mobile environment - simplified approach
      else {
        // Check if MetaMask is installed
        const canOpenMetaMask = await Linking.canOpenURL("metamask://");

        if (canOpenMetaMask) {
          // Open MetaMask
          await Linking.openURL("metamask://");
          
          // Show dialog explaining what to do
          setTimeout(() => {
            Alert.alert(
              "Connect Wallet",
              "Please follow these steps:\n\n1. In MetaMask, tap the three dots (...) at top-right\n2. Tap 'Account details'\n3. Tap your address to copy it\n4. Return to this app\n5. Tap 'Enter Address' below to paste it",
              [
                { text: "Cancel", style: "cancel" },
                { 
                  text: "Enter Address", 
                  onPress: manuallyConnectWallet
                }
              ]
            );
          }, 1000);
        } else {
          // MetaMask not installed
          Alert.alert(
            "MetaMask Not Found",
            "Would you like to install MetaMask?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Install MetaMask",
                onPress: () => Linking.openURL("https://metamask.io/download/"),
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to connect to MetaMask. Please try again.",
      });
    } finally {
      setConnectingWallet(false);
    }
  };

  // Copy text to clipboard
  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Toast.show({
      type: "success",
      text1: "Copied!",
      text2: "Address copied to clipboard.",
    });
  };

  // Fetch wallet details on component mount
  useEffect(() => {
    fetchWalletDetails();
  }, []);

  if (loading) {
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center">
        <ActivityIndicator size="large" color="#FBBF24" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center">
        <Text className="text-red-500 text-lg">{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-primary h-full">
      <View className="p-6">
        
        <Text className="text-5xl font-bold text-purple-700 font-pbold">
          Wallet
        </Text>
        <Text className="text-xl mt-2 text-gray-300 font-psemibold">
          Manage your MetaMask wallet.
        </Text>

        <View className="mt-8">
          {/* Wallet Section */}
          <View className="bg-gray-800 rounded-lg p-6 mb-4">
            <Text className="text-xl text-white font-pbold mb-4">Wallet Status</Text>

            {walletAddress ? (
              <View>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center">
                    <FontAwesome5 name="ethereum" size={24} color="#9CA3AF" />
                    <Text className="ml-3 text-white text-lg font-psemibold">
                      Connected
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={disconnectWallet}
                    className="bg-red-500 px-4 py-2 rounded"
                  >
                    <Text className="text-white font-psemibold">
                      Disconnect
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Wallet Address Display */}
                <View className="bg-gray-700 p-4 rounded-lg mt-4">
                  <Text className="text-gray-400 text-sm mb-2">MetaMask Address</Text>
                  <View className="flex-row justify-between items-center">
                    <TextInput
                      className="text-white text-lg flex-1"
                      value={walletAddress}
                      editable={false}
                    />
                    <TouchableOpacity onPress={() => copyToClipboard(walletAddress)} className="ml-4">
                      <FontAwesome name="copy" size={20} color="#f3f4f6" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Information about the wallet */}
                <View className="mt-6 bg-gray-700 p-4 rounded-lg">
                  <Text className="text-white font-psemibold">Your MetaMask Address</Text>
                  <Text className="text-gray-400 mt-2">
                    This is your Ethereum address connected through MetaMask. You can use it to interact with Ethereum-based applications and services.
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <Text className="text-gray-400 font-psemibold mb-6">
                  No wallet connected. Connect your MetaMask wallet to access decentralized features.
                </Text>
                
                <View className="flex-row flex-wrap">
                  <TouchableOpacity
                    onPress={connectMetaMask}
                    disabled={connectingWallet}
                    className="bg-purple-800 px-4 py-3 rounded-lg mr-2 mb-2 flex-1"
                  >
                    <View className="flex-row justify-center items-center">
                      <FontAwesome5 name="ethereum" size={18} color="#1F2937" />
                      <Text className="ml-2 text-center text-gray-100 font-psemibold">
                        {connectingWallet ? "Connecting..." : "Connect MetaMask"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={manuallyConnectWallet}
                    className="bg-gray-700 px-4 py-3 rounded-lg mb-2 flex-1"
                  >
                    <View className="flex-row justify-center items-center">
                      <Feather name="edit-2" size={18} color="white" />
                      <Text className="ml-2 text-center text-white font-psemibold">
                        Enter Address Manually
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
                
                {/* Information about MetaMask */}
                <View className="mt-6 bg-gray-700 p-4 rounded-lg">
                  <Text className="text-white font-psemibold">What is MetaMask?</Text>
                  <Text className="text-gray-400 mt-2">
                    MetaMask is a crypto wallet and gateway to blockchain apps. It allows you to store and manage account keys, broadcast transactions, and securely connect to decentralized applications.
                  </Text>
                  
                  <TouchableOpacity 
                    onPress={() => Linking.openURL("https://metamask.io/download/")}
                    className="mt-4 bg-gray-600 px-4 py-2 rounded-lg self-start"
                  >
                    <Text className="text-white">Download MetaMask</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
      <Toast />
    </ScrollView>
  );
};

export default WalletPage;