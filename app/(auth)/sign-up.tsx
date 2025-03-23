import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { supabase } from "../supabaseAccess";

const SignUp = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [age, setAge] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    // Form validation
    if (!email || !password || !confirmPassword || !age) {
      Alert.alert("Error", "All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    if (!/^\d+$/.test(age) || parseInt(age) <= 0) {
      Alert.alert("Error", "Please enter a valid age.");
      return;
    }

    setLoading(true);

    try {
      console.log("Checking if email is already registered...");
      // Check if email exists in the user table
      const { data: existingUser, error: fetchError } = await supabase
        .from("user")
        .select("email_id")
        .eq("email_id", email)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Failed to check email availability: ${fetchError.message}`);
      }

      if (existingUser) {
        Alert.alert("Error", "Email is already registered. Try logging in.");
        setLoading(false);
        return;
      }

      // Register user in Supabase Auth
      console.log("Signing up user with Supabase Auth...");
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email,
        password
      });

      if (signupError) {
        throw new Error(`Error signing up: ${signupError.message}`);
      }

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      // Save additional user details in the custom user table
      console.log("User signed up successfully. Saving user details...");
      const { error: insertError } = await supabase.from("user").insert([
        {
          email_id: email,
          pwd: password, // Note: In production, never store plain-text passwords
          age: parseInt(age)
        },
      ]);

      if (insertError) {
        throw new Error(`Error saving user details: ${insertError.message}`);
      }

      console.log("User details saved successfully");
      
      // Sign in immediately after signup
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error("Error signing in after signup:", signInError);
        Alert.alert(
          "Account Created", 
          "Your account was created but we couldn't sign you in automatically. Please try logging in.",
          [{ text: "OK", onPress: () => router.replace("/sign-in") }]
        );
        return;
      }

      // Success - navigate to explore page
      Alert.alert(
        "Success", 
        "Account created successfully!",
        [{ text: "OK", onPress: () => router.replace("/explore") }]
      );
    } catch (error) {
      console.error("Signup error:", error instanceof Error ? error.message : String(error));
      Alert.alert("Error", error instanceof Error ? error.message : "An unexpected error occurred during signup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="bg-primary h-full">
      <ScrollView>
        <View className="w-full justify-center h-full px-7 my-6">
          <View className="mb-10">
            <TouchableOpacity onPress={() => router.back()}>
              <FontAwesome name="arrow-left" size={24} color="#d1d5db" />
            </TouchableOpacity>
          </View>
          <Text className="text-4xl font-psemibold text-purple-700">
            Create Account
          </Text>
          <Text className="text-gray-100 mt-3 font-psemibold text-lg">
            Join the ZKpark community
          </Text>

          <View className="mt-10">
            <View className="mb-6">
              <Text className="text-xl text-gray-300 block mb-2 font-psemibold">
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg p-4 font-psemibold text-white"
                placeholder="your@email.com"
                keyboardType="email-address"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
              />
            </View>

            <View className="mb-6 relative">
              <Text className="text-xl text-gray-300 block mb-2 font-psemibold">
                Password
              </Text>
              <View className="relative">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  className="w-full bg-gray-800 border-2 border-gray-700 font-psemibold rounded-lg p-4 text-gray-100 pr-12"
                  placeholder="••••••••"
                  secureTextEntry={!passwordVisible}
                  placeholderTextColor="#6b7280"
                />
                <TouchableOpacity
                  className="absolute right-4 top-5"
                  onPress={() => setPasswordVisible(!passwordVisible)}
                >
                  <Feather
                    name={passwordVisible ? "eye-off" : "eye"}
                    size={24}
                    color="white"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-6 relative">
              <Text className="text-xl text-gray-300 block mb-2 font-psemibold">
                Confirm Password
              </Text>
              <View className="relative">
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  className="w-full bg-gray-800 border-2 border-gray-700 font-psemibold rounded-lg p-4 text-gray-100 pr-12"
                  placeholder="••••••••"
                  secureTextEntry={!confirmPasswordVisible}
                  placeholderTextColor="#6b7280"
                />
                <TouchableOpacity
                  className="absolute right-4 top-5"
                  onPress={() =>
                    setConfirmPasswordVisible(!confirmPasswordVisible)
                  }
                >
                  <Feather
                    name={confirmPasswordVisible ? "eye-off" : "eye"}
                    size={24}
                    color="white"
                  />
                </TouchableOpacity>
              </View>
              {password !== confirmPassword && confirmPassword.length > 0 && (
                <Text className="text-red-500 mt-2 text-sm font-semibold">
                  Passwords do not match
                </Text>
              )}
            </View>

            <View className="mb-6">
              <Text className="text-xl text-gray-300 block mb-2 font-psemibold">
                Age
              </Text>
              <TextInput
                value={age}
                onChangeText={(text) => {
                  if (/^\d*$/.test(text)) {
                    setAge(text);
                  }
                }}
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg p-4 font-psemibold text-white"
                placeholder="Enter your age"
                keyboardType="numeric"
                placeholderTextColor="#6b7280"
              />
            </View>

            <TouchableOpacity
              onPress={handleSignup}
              disabled={loading}
              className="w-full bg-purple-800 text-gray-900 py-4 rounded-2xl font-semibold flex-row justify-center"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#1F2937" />
              ) : (
                <Text className="text-center text-xl text-gray-100 font-pbold">
                  Sign Up
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <View className="mt-8">
            <View className="flex flex-row items-center gap-4 mb-6">
              <View className="flex-1 border-t border-gray-500" />
              <Text className="text-gray-400 font-pregular">
                or continue with
              </Text>
              <View className="flex-1 border-t border-gray-500" />
            </View>

            <View className="flex-row w-11/12 mx-auto justify-evenly">
              <TouchableOpacity className="flex-row basis-1/3 items-center justify-center gap-2 bg-gray-800 py-5  rounded-lg">
                <FontAwesome5 name="google" size={24} color="white" />
                <Text className="text-white font-psemibold text-lg">
                  Google
                </Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-row basis-1/3 items-center justify-center gap-2 bg-gray-800 py-5 rounded-lg">
                <FontAwesome5 name="apple" size={27} color="white" />
                <Text className="text-white font-psemibold text-lg">Apple</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignUp;