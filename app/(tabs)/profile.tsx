import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, Modal } from "react-native";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import axios from "axios";
import { supabase } from "../supabaseAccess";
import WalletPage from "../(walletDetails)/walletDetails";
import { router } from "expo-router";
import { useFocusEffect } from '@react-navigation/native';

interface LicenseDetails {
  name: string;
  dob: string;
}

const Profile = () => {
  const [loading, setLoading] = useState(false);
  const [licenseDetails, setLicenseDetails] = useState<LicenseDetails | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("User");
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userRewards, setUserRewards] = useState<string>("0");
  const [loadingRewards, setLoadingRewards] = useState(false);

  // Fetch user profile on initial load
  useEffect(() => {
    getPermission();
    fetchUserProfile();
  }, []);

  // Re-fetch user profile whenever the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchUserProfile();
      return () => {}; // Clean up function
    }, [])
  );

  const getPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      alert("Permission to access media library is required!");
    }
  };

  const fetchUserProfile = async () => {
    try {
      console.log("Fetching user profile...");
      setLoading(true);
      
      // Get the current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("Error getting auth user:", userError);
        return;
      }
      
      if (user) {
        console.log("Found authenticated user:", user.email);
        setUserEmail(user.email || "");
        
        // Fetch additional user details from the user table - including wallet_addr
        const { data, error } = await supabase
          .from("user")
          .select("email_id, wallet_addr")
          .eq("email_id", user.email)
          .single();
          
        if (error) {
          console.error("Error fetching user data:", error);
        } else if (data) {
          console.log("User data retrieved:", data);
          
          // Set wallet address
          if (data.wallet_addr) {
            setWalletAddress(data.wallet_addr);
            // Fetch rewards for this wallet
            fetchUserRewards(data.wallet_addr);
          }
          
          // Generate a display name from the email
          if (user.email) {
            const emailName = user.email.split('@')[0];
            const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
            setUserName(displayName);
          }
          
          if (!user.email && data.email_id) {
            setUserEmail(data.email_id);
          }
        } else {
          console.log("No user data found in database");
        }
      } else {
        console.log("No authenticated user found");
      }
    } catch (error) {
      console.error("Error in fetchUserProfile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRewards = async (walletAddr: string) => {
    try {
      setLoadingRewards(true);
      console.log("Fetching rewards for wallet:", walletAddr);
      
      const response = await axios.get(`https://zkpark-b3df457d7927.herokuapp.com/api/token/balance/${walletAddr}`);
      
      if (response.data && response.data.balance) {
        console.log("Rewards fetched successfully:", response.data.balance);
        setUserRewards(response.data.balance.toString());
      } else {
        console.log("No rewards data found");
        setUserRewards("0");
      }
    } catch (error) {
      console.error("Error fetching user rewards:", error);
      setUserRewards("0");
    } finally {
      setLoadingRewards(false);
    }
  };

  // Refresh rewards data
  const refreshRewards = () => {
    if (walletAddress) {
      fetchUserRewards(walletAddress);
    } else {
      Alert.alert("No Wallet Connected", "Please connect a wallet to view your rewards.");
    }
  };

  const handleLogout = async () => {
    try {
      Alert.alert(
        "Logout",
        "Are you sure you want to logout?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Logout",
            onPress: async () => {
              setLoading(true);
              // Sign out the user from Supabase
              const { error } = await supabase.auth.signOut();
              
              if (error) {
                Alert.alert("Error", "Failed to logout. Please try again.");
                console.error("Logout error:", error);
              } else {
                // Navigate to the index page
                router.replace("/");
              }
              setLoading(false);
            }
          }
        ]
      );
    } catch (error) {
      console.error("Error during logout:", error);
      Alert.alert("Error", "An error occurred during logout.");
      setLoading(false);
    }
  };

  const pickProfileImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const formatRewards = (rewards: string) => {
    if (!rewards || rewards === "0") return "0";
    return rewards;
  };

  return (
    <View className="bg-primary h-full p-6">
      {/* Profile Header */}
      <View className="flex-row mt-16 justify-between items-center">
        <Text className="text-purple-700 text-3xl font-bold">Profile</Text>
        <View className="flex-row gap-4">
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#9333EA" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="settings-outline" size={24} color="#9333EA" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Image */}
      <View className="items-center mt-6">
        <TouchableOpacity onPress={pickProfileImage}>
          <Image
            source={profileImage ? { uri: profileImage } : require("../../assets/images/profile.png")}
            className="w-32 h-32 rounded-full border-2 border-gray-500"
          />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-semibold mt-3">{userName}</Text>
        <Text className="text-gray-400 text-xl">{userEmail}</Text>
        
        {/* Wallet Address Display */}
        {walletAddress && (
          <View className="mt-2 bg-gray-800 p-2 px-4 rounded-full">
            <Text className="text-gray-400 text-sm">
              {`${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`}
            </Text>
          </View>
        )}
      </View>

      {/* Stats Section */}
      <View className="flex-row justify-around mt-6">
        <View className="items-center bg-gray-800 w-28 h-24 flex justify-center rounded-xl">
          <Text className="text-purple-600 text-2xl font-pbold">43</Text>
          <Text className="text-gray-100 text-lg">Trips</Text>
        </View>
        <View className="items-center bg-gray-800 w-28 h-24 flex justify-center rounded-xl">
          <Text className="text-purple-600 text-2xl font-pbold">174</Text>
          <Text className="text-gray-100 text-lg">Hours</Text>
        </View>
        <View className="items-center bg-gray-800 w-28 h-24 flex justify-center rounded-xl">
          <View className="flex-row items-center justify-center">
            <Text className="text-purple-600 text-2xl font-pbold mr-2">
              {formatRewards(userRewards)}
            </Text>
            <TouchableOpacity onPress={refreshRewards} disabled={loadingRewards}>
              {loadingRewards ? (
                <ActivityIndicator size="small" color="#9333EA" />
              ) : (
                <Feather name="refresh-cw" size={18} color="#9333EA" />
              )}
            </TouchableOpacity>
          </View>
          <Text className="text-gray-100 text-lg">Rewards</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="mt-8 gap-y-2">
        <TouchableOpacity className="flex-row items-center bg-gray-800 p-4 rounded-xl h-16 mb-3">
          <FontAwesome name="car" size={20} color="#9333EA" />
          <View className="flex flex-row justify-between items-center flex-1">
            <Text className="text-white ml-3 text-lg">My Vehicles</Text>
            <AntDesign name="right" size={18} color="white" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity className="flex-row items-center bg-gray-800 p-4 rounded-xl h-16 mb-3">
          <FontAwesome name="credit-card" size={20} color="#9333EA" />
          <View className="flex flex-row justify-between items-center flex-1">
            <Text className="text-white ml-3 text-lg">Payment Methods</Text>
            <AntDesign name="right" size={18} color="white" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          className="flex-row items-center bg-gray-800 p-4 rounded-xl h-16 mb-3"
          onPress={() => setWalletModalVisible(true)}>
          <AntDesign name="wallet" size={20} color="#9333EA" />
          <View className="flex flex-row justify-between items-center flex-1">
            <Text className="text-white ml-3 text-lg">Wallet</Text>
            <AntDesign name="right" size={18} color="white" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center bg-gray-800 p-4 rounded-xl h-16 mb-3"
          >
          <FontAwesome name="id-card" size={20} color="#9333EA" />
          <View className="flex flex-row justify-between items-center flex-1">
            <Text className="text-white ml-3 text-lg">Upload ID & Get Verified</Text>
            <AntDesign name="right" size={18} color="white" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity className="flex-row items-center bg-gray-800 p-4 h-16 rounded-xl">
          <Ionicons name="help-circle-outline" size={22} color="#9333EA" />
          <View className="flex flex-row justify-between items-center flex-1">
            <Text className="text-white ml-3 text-lg">Help & Support</Text>
            <AntDesign name="right" size={18} color="white" />
          </View>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="large" color="purple" className="mt-4" />}

      {licenseDetails && (
        <View className="bg-gray-800 p-4 rounded-lg mt-4">
          <Text className="text-white text-lg font-bold">License Details:</Text>
          <View className="gap-y-1">
            <Text className="text-gray-400">Name: {licenseDetails.name}</Text>
            <Text className="text-gray-400">DOB: {licenseDetails.dob}</Text>
          </View>
        </View>
      )}

      {/* Wallet Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={walletModalVisible}
        onRequestClose={() => setWalletModalVisible(false)}
      >
        <View className="flex-1 bg-primary">
          <View className="pt-14 pl-4">
            <TouchableOpacity onPress={() => setWalletModalVisible(false)}>
              <AntDesign name="arrowleft" size={24} color="#7e22ce" />
            </TouchableOpacity>
          </View>
          <WalletPage />
        </View>
      </Modal>
    </View>
  );
};

export default Profile;