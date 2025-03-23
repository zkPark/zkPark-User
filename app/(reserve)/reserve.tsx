import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Alert, Image, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from '@expo/vector-icons/Ionicons';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Dropdown } from 'react-native-element-dropdown';
import CalendarPicker from 'react-native-calendar-picker';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Entypo from '@expo/vector-icons/Entypo';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabaseAccess";

// Define type for station details
type ParkingSpot = {
  id: string;
  title: string;
  price: string;
  distance: string;
  latitude: number;
  longitude: number;
  image_url?: string;
};

type ParkingTransactionData = {
  useremail_id: string;
  provideremail_id: string;
  date: string;
  from_time: string;
  to_time: string;
  provider_earned_rewards: string;
  user_earned_rewards: string;
  transaction_link: string;
  nft_id: string;
  provider_wallet_addr: string;
  user_wallet_addr: string;
  parking_id?: string;
};

// New type for API request
type ReservationApiRequest = {
  user: string;
  spotOwner: string;
  startTime: string;
  endTime: string;
};

// New type for API response
type ReservationApiResponse = {
  success: boolean;
  message: string;
  sessionId: string;
};

// New type for session data to be saved to Supabase
type ParkingSessionData = {
  user_email_id: string;
  user_wallet_addr: string;
  owner_email_id: string;
  owner_wallet_addr: string;
  session_id: string;
  start_timestamp: string;
  end_timestamp: string;
};

const vehicleOptions = [
  { label: "Tesla Model 3", value: "Tesla Model 3" },
  { label: "Tesla Model Y", value: "Tesla Model Y" },
  { label: "Nissan Leaf", value: "Nissan Leaf" },
];

const Reserve = () => {
  const router = useRouter();
  const { station } = useLocalSearchParams<{ station: string }>();
  const [selectedVehicle, setSelectedVehicle] = useState("Tesla Model 3");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [isStartTimePickerVisible, setIsStartTimePickerVisible] = useState(false);
  const [isEndTimePickerVisible, setIsEndTimePickerVisible] = useState(false);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userWalletAddr, setUserWalletAddr] = useState<string | null>(null);
  const [providerEmail, setProviderEmail] = useState<string | null>(null);
  const [providerWalletAddr, setProviderWalletAddr] = useState<string | null>(null);
  const [parkingId, setParkingId] = useState<string | null>(null);
  const [parkingFee, setParkingFee] = useState<string>("--");
  const [serviceFee, setServiceFee] = useState<string>("0.25");
  const [totalFee, setTotalFee] = useState<string>("--");
  const [parkingImages, setParkingImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processingApi, setProcessingApi] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Parse the station object passed from explore.tsx
  const parsedSpot: ParkingSpot = station ? JSON.parse(station) : null;

  // Fetch user details on component mount
  useEffect(() => {
    fetchUserProfile();
    if (parsedSpot && parsedSpot.id) {
      setParkingId(parsedSpot.id);
      fetchParkingDetails(parsedSpot.id);
    }
  }, []);

  // Fetch the current user's profile from Supabase
  const fetchUserProfile = async () => {
    try {
      console.log("Fetching user profile...");
      
      // Get the current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("Error getting auth user:", userError);
        return;
      }
      
      if (user) {
        console.log("Found authenticated user:", user.email);
        setUserEmail(user.email || "");
        
        // Fetch additional user details from the user table, including wallet address
        const { data, error } = await supabase
          .from("user")
          .select("email_id, wallet_addr")
          .eq("email_id", user.email)
          .single();
          
        if (error) {
          console.error("Error fetching user data:", error);
        } else if (data) {
          console.log("User data retrieved:", data);
          
          // Set email as a fallback in case the auth user email is empty
          if (!user.email && data.email_id) {
            setUserEmail(data.email_id);
          }
          
          // Set user wallet address
          if (data.wallet_addr) {
            setUserWalletAddr(data.wallet_addr);
            console.log("User wallet address:", data.wallet_addr);
          } else {
            console.log("No wallet address found for user");
          }
        } else {
          console.log("No user data found in database");
        }
      } else {
        console.log("No authenticated user found");
        Alert.alert("Error", "Please login to make reservations");
        router.replace("/sign-in");
      }
    } catch (error) {
      console.error("Error in fetchUserProfile:", error);
    }
  };

  // Fetch parking details including provider email and image
  const fetchParkingDetails = async (parkingId: string) => {
    try {
      console.log("Fetching parking details for ID:", parkingId);
      
      // Since we're having UUID issues, let's directly use the parsed spot data
      // and fetch the provider email using the latitude/longitude as identifiers
      if (parsedSpot) {
        // First, try to get provider email directly from the data passed from explore.tsx
        const { data: parkingData, error: parkingError } = await supabase
          .from("parking")
          .select("*")
          .eq("lat", parsedSpot.latitude.toString())
          .eq("long", parsedSpot.longitude.toString());

        if (parkingError) {
          console.error("Error fetching parking by coordinates:", parkingError);
        } else if (parkingData && parkingData.length > 0) {
          console.log("Found parking data by coordinates:", parkingData[0]);
          
          // Set provider email from the first matching record
          if (parkingData[0].email_id) {
            setProviderEmail(parkingData[0].email_id);
            console.log("Provider email:", parkingData[0].email_id);
            
            // Fetch provider wallet address from user table
            const { data: userData, error: userError } = await supabase
              .from("user")
              .select("wallet_addr")
              .eq("email_id", parkingData[0].email_id)
              .single();
              
            if (userError) {
              console.error("Error fetching provider wallet address:", userError);
            } else if (userData && userData.wallet_addr) {
              setProviderWalletAddr(userData.wallet_addr);
              console.log("Provider wallet address:", userData.wallet_addr);
            } else {
              console.log("No wallet address found for provider");
            }
            
            // Set parking images - only one image
            if (parkingData[0].purl1) {
              setParkingImages([parkingData[0].purl1]);
            } else if (parsedSpot.image_url) {
              setParkingImages([parsedSpot.image_url]);
            } else {
              setParkingImages([]);
            }
          }
        } else {
          console.log("No parking data found by coordinates");
          
          // If we have an image from the explore screen, use that
          if (parsedSpot.image_url) {
            setParkingImages([parsedSpot.image_url]);
          }
        }
      }
    } catch (error) {
      console.error("Error in fetchParkingDetails:", error);
    }
  };

  if (!parsedSpot) {
    return (
      <View className="bg-primary h-full justify-center items-center">
        <Text className="text-white text-lg">No parking spot data available.</Text>
      </View>
    );
  }

  // Function to format date and time for API
  const formatDateTimeForApi = (date: string, time: string): string => {
    // Format: "2025-03-23T12:00:00Z"
    return `${date}T${time}:00Z`;
  };

  // Call the reservation API
  const callReservationApi = async (): Promise<ReservationApiResponse> => {
    try {
      if (!userWalletAddr) {
        throw new Error("User wallet address not found");
      }
      
      if (!providerWalletAddr) {
        throw new Error("Provider wallet address not found");
      }
      
      if (!selectedDate || !startTime || !endTime) {
        throw new Error("Date or time not selected");
      }
      
      // Format the date and times for the API
      const formattedStartTime = formatDateTimeForApi(selectedDate, startTime);
      const formattedEndTime = formatDateTimeForApi(selectedDate, endTime);
      
      // Prepare the API request data
      const requestData: ReservationApiRequest = {
        user: userWalletAddr,
        spotOwner: providerWalletAddr,
        startTime: formattedStartTime,
        endTime: formattedEndTime
      };
      
      console.log("Calling reservation API with data:", requestData);
      
      // Make the API call
      const response = await fetch('https://zkpark-b3df457d7927.herokuapp.com/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log("API response:", data);
      
      return data as ReservationApiResponse;
    } catch (error) {
      console.error("Error calling reservation API:", error);
      throw error;
    }
  };

  // Save session to Supabase
  const saveSessionToSupabase = async (sessionId: string) => {
    try {
      if (!userEmail || !userWalletAddr || !providerEmail || !providerWalletAddr || !selectedDate || !startTime || !endTime) {
        throw new Error("Missing required data for session");
      }
      
      const formattedStartTime = formatDateTimeForApi(selectedDate, startTime);
      const formattedEndTime = formatDateTimeForApi(selectedDate, endTime);
      
      // Prepare session data for Supabase
      const sessionData: ParkingSessionData = {
        user_email_id: userEmail,
        user_wallet_addr: userWalletAddr,
        owner_email_id: providerEmail,
        owner_wallet_addr: providerWalletAddr,
        session_id: sessionId,
        start_timestamp: formattedStartTime,
        end_timestamp: formattedEndTime
      };
      
      console.log("Saving session to Supabase:", sessionData);
      
      // Insert the session data into the parking_session table
      const { data, error } = await supabase
        .from("parking_session")
        .insert([sessionData])
        .select();
      
      if (error) {
        throw error;
      }
      
      console.log("Session saved to Supabase successfully:", data);
      return data;
    } catch (error) {
      console.error("Error saving session to Supabase:", error);
      throw error;
    }
  };

  // Handle date selection from the calendar
  const handleDateSelect = (date: Date) => {
    // Format the date as YYYY-MM-DD for consistency with varchar in database
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    setSelectedDate(formattedDate);
    setIsCalendarVisible(false); // Hide the calendar after selection
  };

  // Handle time selection (start and end time)
  const handleStartTimeConfirm = (time: Date) => {
    // Round to nearest hour
    const roundedTime = new Date(time);
    roundedTime.setMinutes(0);
    roundedTime.setSeconds(0);
    
    // Format time as HH:MM for database consistency
    const hours = String(roundedTime.getHours()).padStart(2, '0');
    const formattedTime = `${hours}:00`;
    
    setStartTime(formattedTime);
    setIsStartTimePickerVisible(false);
  };
  
  const handleEndTimeConfirm = (time: Date) => {
    // Round to nearest hour
    const roundedTime = new Date(time);
    roundedTime.setMinutes(0);
    roundedTime.setSeconds(0);
    
    // Format time as HH:MM for database consistency
    const hours = String(roundedTime.getHours()).padStart(2, '0');
    const formattedTime = `${hours}:00`;
    
    setEndTime(formattedTime);
    setIsEndTimePickerVisible(false);
  };

  const handleConfirmReservation = async () => {
    // Input validation
    if (!selectedDate || !startTime || !endTime) {
      Alert.alert("Error", "Please select date, start time, and end time.");
      return;
    }

    if (!userEmail) {
      Alert.alert("Error", "User email not found. Please log in again.");
      return;
    }

    if (!userWalletAddr) {
      Alert.alert("Error", "User wallet address not found. Please connect your wallet first.");
      return;
    }

    if (!providerEmail) {
      Alert.alert("Error", "Provider information not found.");
      return;
    }

    if (!providerWalletAddr) {
      Alert.alert("Error", "Provider wallet address not found.");
      return;
    }

    if (!parkingId) {
      Alert.alert("Error", "Parking ID not found.");
      return;
    }

    // Validate time slots
    if (startTime >= endTime) {
      Alert.alert("Error", "End time must be later than start time.");
      return;
    }

    setLoading(true);
    setProcessingApi(true);

    try {
      // Step 1: Call the reservation API
      console.log("Step 1: Calling reservation API...");
      const apiResponse = await callReservationApi();
      
      if (!apiResponse.success || !apiResponse.sessionId) {
        throw new Error("Failed to create reservation session");
      }
      
      // Store the session ID
      setSessionId(apiResponse.sessionId);
      console.log("Received session ID:", apiResponse.sessionId);
      
      // Step 2: Save the session data to Supabase
      console.log("Step 2: Saving session to Supabase...");
      await saveSessionToSupabase(apiResponse.sessionId);
      
      // Step 3: Handle parking reservation in the original table (skipped now)
      console.log("Step 3: Creating parking transaction record...");
      const parkingResult = await handleParkingReservation();

      // Step 4: Save to AsyncStorage for local access
      // Create a reservation object that matches the Trips page format
      const reservationForTrips = {
        id: apiResponse.sessionId,
        title: parsedSpot.title,
        date: selectedDate,
        from_time: startTime,
        to_time: endTime,
        price: `$${totalFee}`,
        status: "Active",
        type: "parking",
        parking_id: parkingId,
        // Add these fields to match the Trips page expected format
        parking_transaction_id: apiResponse.sessionId,
        user_wallet_addr: userWalletAddr,
        provider_wallet_addr: providerWalletAddr,
        session_id: apiResponse.sessionId
      };

      // Get existing reservations from AsyncStorage
      const existingReservations = await AsyncStorage.getItem("reservations");
      const reservations = existingReservations ? JSON.parse(existingReservations) : [];

      // Add the new reservation
      reservations.push(reservationForTrips);

      // Save back to storage
      await AsyncStorage.setItem("reservations", JSON.stringify(reservations));

      // Show success message
      Alert.alert("Success", "Reservation confirmed successfully!", [
        { 
          text: "OK", 
          onPress: () => router.push({
            pathname: "/(tabs)/trips",
            params: { 
              totalFee: totalFee.toString(),
              newReservation: "true",
              sessionId: apiResponse.sessionId
            }
          }) 
        }
      ]);
    } catch (error) {
      console.error("Error in reservation process:", error);
      Alert.alert("Error", "Failed to complete reservation. Please try again.");
    } finally {
      setLoading(false);
      setProcessingApi(false);
    }
  };

  // Handle parking reservation specifically
  const handleParkingReservation = async () => {
    // Input validation
    if (!userEmail || !providerEmail || !parkingId || !selectedDate || !startTime || !endTime) {
      throw new Error("Missing required data for reservation");
    }
    
    // Skip checking for conflicts since the table doesn't exist
    // Just continue with the reservation process

    // Create transaction data object
    const transactionData: ParkingTransactionData = {
      useremail_id: userEmail,
      provideremail_id: providerEmail,
      date: selectedDate,
      from_time: startTime,
      to_time: endTime,
      provider_earned_rewards: "0",
      user_earned_rewards: "0",
      transaction_link: "",
      nft_id: sessionId || "", // Use the session ID as the NFT ID if available
      provider_wallet_addr: providerWalletAddr || "",
      user_wallet_addr: userWalletAddr || "",
      parking_id: parkingId
    };

    // We'll skip the actual insert to Parking_Transactions since it doesn't exist
    console.log("Parking transaction data prepared (not inserted to DB):", transactionData);
    
    return { id: "generated-id-" + Date.now() }; // Return a fake response with an ID
  };

  // Create a function to calculate pricing
  const calculatePricing = () => {
    if (startTime && endTime) {
      // Calculate hours difference
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      
      // Calculate hours, ensuring positive value
      const hoursDiff = Math.abs(
        (end.getHours() - start.getHours()) % 24
      );
      
      // Calculate fees
      const hourlyRate = 2; // $2 per hour
      const calculatedParkingFee = (hoursDiff * hourlyRate).toFixed(2);
      const calculatedServiceFee = "0.25";
      const calculatedTotal = (
        parseFloat(calculatedParkingFee) + parseFloat(calculatedServiceFee)
      ).toFixed(2);
      
      setParkingFee(calculatedParkingFee);
      setTotalFee(calculatedTotal);
    } else {
      // Reset to default
      setParkingFee("--");
      setTotalFee("--");
    }
  };

  // Call calculatePricing when start or end time changes
  useEffect(() => {
    calculatePricing();
  }, [startTime, endTime]);

  return (
    <ScrollView className="bg-primary h-full">
      <View className="gap-4 p-6">
        {/* Back Button and Title */}
        <View className="flex flex-row items-center gap-4 mt-2">
          <Ionicons name="arrow-back" size={24} color="white" onPress={() => router.back()} />
          <Text className="text-3xl font-bold text-white">Reserve Parking</Text>
        </View>

        {/* Parking Spot Details */}
        <View className="bg-gray-800 p-4 rounded-lg mt-2">
          <View className="flex flex-row items-center mt-2">
            <Text className="text-white text-lg flex-1 text-wrap font-bold">{parsedSpot.title}</Text>
            <Text className="bg-purple-600 ml-8 text-white px-2 py-1 rounded text-sm font-bold">
              {parsedSpot.price}
            </Text>
          </View>
          <Text className="text-gray-400 font-semibold mt-1">{parsedSpot.distance} away</Text>
          
          {/* Parking indicator */}
          <View className="flex-row items-center mt-2">
            <View className="bg-purple-800 rounded-full w-6 h-6 justify-center items-center mr-2">
              <Text className="text-white font-bold text-xs">P</Text>
            </View>
            <Text className="text-purple-400 font-semibold">Parking Available</Text>
          </View>
        </View>

        {/* Wallet Status */}
        <View className="bg-gray-800 p-4 rounded-lg mt-2">
          <Text className="text-white font-bold mb-2">Wallet Status</Text>
          {userWalletAddr ? (
            <View className="flex-row items-center">
              <View className="bg-green-500 rounded-full w-3 h-3 mr-2" />
              <Text className="text-green-400">Wallet Connected</Text>
            </View>
          ) : (
            <View>
              <View className="flex-row items-center">
                <View className="bg-red-500 rounded-full w-3 h-3 mr-2" />
                <Text className="text-red-400">Wallet Not Connected</Text>
              </View>
              <TouchableOpacity 
                onPress={() => router.push("/(walletDetails)/walletDetails")}
                className="bg-purple-800 px-3 py-2 rounded mt-2 self-start"
              >
                <Text className="text-white">Connect Wallet</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Parking Images Section */}
        {parkingImages.length > 0 && (
          <View>
            <Text className="text-white font-bold mt-2">Images</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              className="mt-2"
            >
              {parkingImages.map((imageUrl, index) => (
                <TouchableOpacity 
                  key={index} 
                  onPress={() => setSelectedImage(imageUrl)}
                  className="mr-2"
                >
                  <Image 
                    source={{ uri: imageUrl }} 
                    className="w-40 h-40 rounded-lg" 
                    resizeMode="cover" 
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        
        {/* Full Screen Image Modal */}
        {selectedImage && (
          <Modal 
            visible={!!selectedImage}
            transparent={true}
            animationType="fade"
          >
            <View className="flex-1 bg-black/90 justify-center items-center">
              <TouchableOpacity 
                onPress={() => setSelectedImage(null)}
                className="absolute top-12 m-4 mt-10 right-6 z-50"
              >
                <Ionicons name="close" size={36} color="white" />
              </TouchableOpacity>
              <Image 
                source={{ uri: selectedImage }} 
                className="w-[90%] h-[70%]" 
                resizeMode="contain" 
              />
            </View>
          </Modal>
        )}

        {/* Date Picker */}
        <Text className="text-white font-bold mt-2">Date</Text>
        <View className="flex flex-row items-center bg-gray-800 rounded mt-2">
          <TextInput
            className="flex-1 text-white p-3"
            placeholder="YYYY-MM-DD"
            placeholderTextColor="white"
            value={selectedDate || ""}
            editable={false} // Disable manual input
          />
          <TouchableOpacity
            className="p-3"
            onPress={() => setIsCalendarVisible(true)}
          >
            <AntDesign name="calendar" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Calendar Picker Modal */}
        <Modal
          visible={isCalendarVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsCalendarVisible(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/50">
            <View className="bg-gray-800 p-4 rounded-lg w-full">
              <CalendarPicker
                onDateChange={handleDateSelect}
                selectedDayColor="#8b5cf6" // Changed to purple to match theme
                selectedDayTextColor="#fff"
                todayBackgroundColor="#444"
                textStyle={{ color: 'white' }}
                previousTitleStyle={{ color: 'white' }}
                nextTitleStyle={{ color: 'white' }}
                minDate={new Date()} // Only future dates
              />
              <TouchableOpacity
                className="mt-4 p-2 bg-purple-800 rounded-full"
                onPress={() => setIsCalendarVisible(false)}
              >
                <Text className="text-white text-center font-bold">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Time Picker */}
        <View className="flex flex-row justify-between mt-2">
          <View className="w-[48%]">
            <Text className="text-white font-bold">Start Time</Text> 
            <TouchableOpacity
              className="bg-gray-800 text-white p-3 rounded mt-2"
              onPress={() => setIsStartTimePickerVisible(true)}
            >
            <View className="flex flex-row items-center justify-between">
                <Text className="text-white">{startTime || "--:--"}</Text>
                <Entypo name="select-arrows" size={24} color="white" />
              </View>
            </TouchableOpacity>
            <DateTimePickerModal
              isVisible={isStartTimePickerVisible}
              mode="time"
              onConfirm={handleStartTimeConfirm}
              onCancel={() => setIsStartTimePickerVisible(false)}
              is24Hour={true}
            />
          </View>
          <View className="w-[48%]">
            <Text className="text-white font-bold">End Time</Text>
            <TouchableOpacity
              className="bg-gray-800 text-white p-3 rounded mt-2"
              onPress={() => setIsEndTimePickerVisible(true)}
            >
              <View className="flex flex-row items-center justify-between">
                <Text className="text-white">{endTime || "--:--"}</Text>
                <Entypo name="select-arrows" size={24} color="white" />
              </View>
            </TouchableOpacity>
            <DateTimePickerModal
              isVisible={isEndTimePickerVisible}
              mode="time"
              onConfirm={handleEndTimeConfirm}
              onCancel={() => setIsEndTimePickerVisible(false)}
              minuteInterval={30} // Set time intervals to 30 minutes
            />
          </View>
        </View>

        {/* Vehicle Selection */}
        <Text className="text-white font-bold mt-2">Select Vehicle</Text>
        <View className="bg-gray-800 rounded mt-2 p-3">
          <Dropdown
            data={vehicleOptions}
            labelField="label"
            valueField="value"
            value={selectedVehicle}
            onChange={(item) => setSelectedVehicle(item.value)}
            placeholder="Select a vehicle"
            placeholderStyle={{ color: "gray" }}
            selectedTextStyle={{ color: "white" }}
            containerStyle={{ backgroundColor: "gray" }}
          />
        </View>

        {/* Pricing Details */}
        <View className="bg-gray-900 p-4 rounded-lg mt-2">
          <View className="flex flex-row justify-between">
            <Text className="text-gray-400 font-bold">Parking Fee</Text>
            <Text className="text-white">${parkingFee}</Text>
          </View>
          <View className="flex flex-row justify-between mt-2">
            <Text className="text-gray-400 font-bold">Service Fee</Text>
            <Text className="text-white">${serviceFee}</Text>
          </View>
          <View className="flex flex-row justify-between mt-4 border-t border-gray-700 pt-2">
            <Text className="text-white font-bold">Total</Text>
            <Text className="text-purple-400 font-bold">${totalFee}</Text>
          </View>
        </View>

        {/* Confirm Button with loading state */}
        <TouchableOpacity 
          onPress={handleConfirmReservation} 
          className={`${loading ? 'bg-purple-700' : 'bg-purple-800'} p-4 rounded-full mt-6 mb-4 flex-row justify-center items-center`}
          disabled={loading || !userWalletAddr}
                 >
         {processingApi ? (
           <>
             <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
             <Text className="text-gray-100 text-center text-xl font-bold">
               Processing Blockchain...
             </Text>
           </>
         ) : (
           <Text className="text-gray-100 text-center text-xl font-bold">
             {loading ? "Processing..." : userWalletAddr ? "Confirm Reservation" : "Connect Wallet First"}
           </Text>
         )}
         </TouchableOpacity>
               </View>
             </ScrollView>
           );
      };
         
  export default Reserve;