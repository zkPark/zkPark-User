import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from "../supabaseAccess";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSavedReservations } from "../SavedReservationsContext";

// Define the structure of a reservation
type Reservation = {
  id?: string; // Primary key from either Parking_Transactions 
  parking_transaction_id?: string; 
  title: string;
  date: string;
  from_time?: string;
  to_time?: string;
  startTime?: string; // Alternative format from AsyncStorage
  endTime?: string; // Alternative format from AsyncStorage
  price: string;
  status: "Active" | "Completed";
  parking_id?: string;
  type: "parking" ; // Field to distinguish type
  isSaved?: boolean;
  session_id?: string;
  sessionId?: string;
};

const Trips = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedTab, setSelectedTab] = useState<"Active" | "Completed">("Active");
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { addSavedReservation, removeSavedReservation, isSaved } = useSavedReservations();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Check if we have a new reservation from params
  const newReservation = params.newReservation === "true";
  const sessionId = params.sessionId as string | undefined;

  const toggleReservation = async (trip: Reservation) => {
    try {
      // Use the appropriate ID field based on reservation type
      let reservationId = trip.id || trip.parking_transaction_id || trip.session_id || trip.sessionId;
      
      // If we still don't have an ID, generate one from the combination of properties
      if (!reservationId) {
        console.log("No standard ID found, creating synthetic ID for:", trip);
        // Create a synthetic ID from date + times + type
        const fromTime = trip.from_time || trip.startTime;
        const toTime = trip.to_time || trip.endTime;
        reservationId = `${trip.type}-${trip.date}-${fromTime}-${toTime}`;
        console.log("Created synthetic ID:", reservationId);
      }
      
      if (isSaved(reservationId)) {
        await removeSavedReservation(reservationId);
      } else {
        // Create a copy of the trip without optional properties
        const savedTrip = {
          id: trip.id || '',
          parking_transaction_id: trip.parking_transaction_id || '',
          title: trip.title,
          date: trip.date,
          from_time: trip.from_time || trip.startTime || '00:00',  
          to_time: trip.to_time || trip.endTime || '00:00',  
          price: trip.price,
          status: trip.status,
          type: trip.type,
          parking_id: trip.parking_id || '',
        };
        await addSavedReservation(savedTrip);
      }
    } catch (error) {
      console.error('Error toggling reservation:', error);
    }
  };

  useEffect(() => {
    fetchUserEmail();
  }, []);

  useEffect(() => {
    if (userEmail) {
      fetchReservations();
    }
  }, [userEmail, selectedTab, newReservation, sessionId]);

  const fetchUserEmail = async () => {
    try {
      // Get the authenticated user
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error("Error fetching user:", error);
        // Instead of redirecting, we'll use a static email for testing
        setUserEmail("test@example.com");
        return;
      }
      
      if (user && user.email) {
        setUserEmail(user.email);
      } else {
        // For testing, use a static email
        setUserEmail("test@example.com");
      }
    } catch (error) {
      console.error("Error in fetchUserEmail:", error);
      setUserEmail("test@example.com");
    }
  };

  // Function to check if a reservation is completed based on date and time
  const isReservationCompleted = (dateStr: string, timeStr: string): boolean => {
    try {
      const now = new Date();
      const [year, month, day] = dateStr.split('-').map(num => parseInt(num));
      const [hours, minutes] = timeStr.split(':').map(num => parseInt(num));
      
      const reservationEndTime = new Date(year, month - 1, day, hours, minutes);
      
      return now > reservationEndTime;
    } catch (error) {
      console.error("Error in isReservationCompleted:", error);
      return false;
    }
  };

  // Helper function to calculate total fee
  const calculateTotalFee = (startTime: string, endTime: string): string => {
    // Calculate hours difference for pricing
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    const hoursDiff = Math.abs(
      (end.getHours() - start.getHours()) % 24
    );
    
    const hourlyRate = 2; // $2 per hour
    const baseFee = (hoursDiff * hourlyRate).toFixed(2);
    const serviceFee = "0.25";
    const totalFee = (
      parseFloat(baseFee) + parseFloat(serviceFee)
    ).toFixed(2);
    
    return totalFee;
  };

  const fetchReservations = async () => {
    setLoading(true);
    try {
      // First get reservations from AsyncStorage (this includes new reservations)
      const storedReservations = await AsyncStorage.getItem("reservations");
      let reservationsFromStorage: Reservation[] = [];
      
      if (storedReservations) {
        try {
          const parsed = JSON.parse(storedReservations);
          
          // Process and standardize the data format
          reservationsFromStorage = parsed.map((item: any) => {
            // Convert the format to match our Reservation type
            return {
              id: item.id || item.sessionId || `local-${Date.now()}`,
              parking_transaction_id: item.parking_transaction_id || item.sessionId,
              title: item.title || "Parking Spot",
              date: item.date,
              from_time: item.from_time || item.startTime,
              to_time: item.to_time || item.endTime,
              price: item.price.startsWith('$') ? item.price : `$${item.price}`,
              status: "Active", // Assume all new reservations are active
              type: "parking", // Default to parking
              parking_id: item.parking_id || "",
              session_id: item.sessionId || item.session_id
            };
          });
        } catch (e) {
          console.error("Error parsing stored reservations:", e);
        }
      }
      
      console.log("Found reservations in AsyncStorage:", reservationsFromStorage.length);
      
      // Check if the new sessionId from params exists in the list
      // If we have a new reservation, highlight it by fetching data from parking_session table
      if (newReservation && sessionId) {
        try {
          console.log("Fetching details for new reservation with sessionId:", sessionId);
          
          // Get details from parking_session table
          const { data: sessionData, error: sessionError } = await supabase
            .from("parking_session")
            .select("*")
            .eq("session_id", sessionId)
            .single();
            
          if (sessionError) {
            console.error("Error fetching session data:", sessionError);
          } else if (sessionData) {
            console.log("Found session data:", sessionData);
            
            // Format the date and time
            const startDate = new Date(sessionData.start_timestamp);
            const endDate = new Date(sessionData.end_timestamp);
            
            const formattedDate = startDate.toISOString().split('T')[0];
            const startTime = startDate.toTimeString().substring(0, 5);
            const endTime = endDate.toTimeString().substring(0, 5);
            
            // Check if this session is already in our list
            const existingIndex = reservationsFromStorage.findIndex(
              r => r.session_id === sessionId || r.sessionId === sessionId
            );
            
            // If it exists, update it, otherwise add it
            if (existingIndex >= 0) {
              console.log("Updating existing reservation with session details");
              reservationsFromStorage[existingIndex] = {
                ...reservationsFromStorage[existingIndex],
                date: formattedDate,
                from_time: startTime,
                to_time: endTime,
                session_id: sessionId
              };
            } else {
              console.log("Adding new reservation from session data");
              // Create a new reservation entry
              reservationsFromStorage.push({
                id: sessionId,
                parking_transaction_id: sessionId,
                title: "New Parking Reservation",
                date: formattedDate,
                from_time: startTime,
                to_time: endTime,
                price: params.totalFee ? `$${params.totalFee}` : "$4.25",
                status: "Active",
                type: "parking",
                session_id: sessionId
              });
            }
          }
        } catch (error) {
          console.error("Error processing new reservation:", error);
        }
      }
      
      // Create static data for additional reservations
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      const formatDate = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      };
      
      const mockReservations: Reservation[] = [
        // Active Parking Reservations
        {
          id: "p1",
          parking_transaction_id: "p1",
          title: "Downtown Parking Garage",
          date: formatDate(tomorrow),
          from_time: "09:00",
          to_time: "12:00",
          price: "$6.25",
          status: "Active",
          type: "parking",
          parking_id: "parking-1"
        },
        {
          id: "p2",
          parking_transaction_id: "p2",
          title: "Central Plaza Parking",
          date: formatDate(today),
          from_time: "14:00",
          to_time: "18:00",
          price: "$8.25",
          status: "Active",
          type: "parking",
          parking_id: "parking-2"
        },
        
        // Completed Parking Reservations
        {
          id: "p3",
          parking_transaction_id: "p3",
          title: "Market Street Parking",
          date: formatDate(yesterday),
          from_time: "10:00",
          to_time: "15:00",
          price: "$10.25",
          status: "Completed",
          type: "parking",
          parking_id: "parking-3"
        },
        {
          id: "p4",
          parking_transaction_id: "p4",
          title: "Convention Center Parking",
          date: "2023-03-10",
          from_time: "08:00",
          to_time: "17:00",
          price: "$18.25",
          status: "Completed",
          type: "parking",
          parking_id: "parking-4"
        }
      ];
      
      // Combine mock data with real data from AsyncStorage, prioritizing real data
      const combinedReservations = [...reservationsFromStorage, ...mockReservations];
      
      // Remove duplicates (prefer AsyncStorage entries over mock data)
      const uniqueReservations = combinedReservations.filter((res, index, self) => {
        const id = res.id || res.parking_transaction_id || res.session_id;
        return index === self.findIndex(r => (r.id === id || r.parking_transaction_id === id || r.session_id === id));
      });
      
      setReservations(uniqueReservations);
    } catch (error) {
      console.error("Error fetching reservations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter reservations based on selected tab
  const filteredReservations = reservations.filter((trip) => trip.status === selectedTab);

  // Handle deletion of a reservation
  const handleDelete = (trip: Reservation) => {
    const reservationId = trip.id || trip.parking_transaction_id || trip.session_id;
    
    Alert.alert("Delete Reservation", "Are you sure you want to delete this reservation?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        onPress: async () => {
          // Remove from state
          const updatedReservations = reservations.filter(
            (reservation) => {
              const id = reservation.id || reservation.parking_transaction_id || reservation.session_id;
              return id !== reservationId;
            }
          );
          setReservations(updatedReservations);
          
          // Also remove from AsyncStorage
          try {
            const storedReservations = await AsyncStorage.getItem("reservations");
            if (storedReservations) {
              const parsed = JSON.parse(storedReservations);
              const filtered = parsed.filter((res: any) => {
                const id = res.id || res.sessionId || res.parking_transaction_id;
                return id !== reservationId;
              });
              await AsyncStorage.setItem("reservations", JSON.stringify(filtered));
            }
          } catch (e) {
            console.error("Error updating AsyncStorage after deletion:", e);
          }
        },
      },
    ]);
  };

  // Show coming soon alert for trip details
  const showComingSoonAlert = () => {
    Alert.alert(
      "Coming Soon!",
      "Trip details feature will be available in the next update.",
      [{ text: "OK", style: "default" }]
    );
  };

  if (loading) {
    return (
      <View className="bg-primary h-full justify-center items-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  return (
    <View className="bg-primary h-full p-6">
      <Text className="text-3xl font-bold text-purple-700 mb-4 mt-16">My Trips</Text>

      {/* Toggle Tabs */}
      <View className="flex flex-row justify-center mb-4">
        {["Active", "Completed"].map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setSelectedTab(tab as "Active" | "Completed")}
            className="px-4 py-2 mx-2"
          >
            <Text
              className={`text-lg font-bold ${
                selectedTab === tab ? "text-purple-600" : "text-gray-200"
              }`}
            >
              {tab}
            </Text>
            {selectedTab === tab && <View className="h-1 bg-purple-600 mt-1 rounded-full"></View>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Refresh Button */}
      <TouchableOpacity 
        onPress={fetchReservations} 
        className="absolute top-16 right-6"
      >
        <Ionicons name="refresh" size={24} color="white" />
      </TouchableOpacity>

      {/* Reservations List */}
      <ScrollView>
        {filteredReservations.length === 0 ? (
          <Text className="text-gray-400 text-center mt-4">
            No {selectedTab.toLowerCase()} trips yet.
          </Text>
        ) : (
          filteredReservations.map((trip, index) => {
            // Determine the ID to use for key and operations
            const tripId = trip.id || trip.parking_transaction_id || trip.session_id || trip.sessionId || `trip-${index}`;
            
            return (
              <View 
                key={tripId} 
                className="bg-gray-800 p-4 rounded-lg mb-4 shadow-md"
              >
                {/* Header with Type and Bookmark */}
                <View className="flex-row justify-between items-start mb-3">
                  {/* Reservation Type Indicator */}
                  <View className="flex-row items-center flex-1">
                    {trip.type === "parking" ? (
                      <View className="bg-purple-800 rounded-full w-7 h-7 justify-center items-center mr-3">
                        <Text className="text-white font-bold text-xs">P</Text>
                      </View>
                    ) : (
                      <View className="bg-purple-800 rounded-full w-7 h-7 justify-center items-center mr-3">
                        <MaterialIcons name="bolt" size={16} color="white" />
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-white text-lg font-bold" numberOfLines={2}>
                        {trip.title}
                      </Text>
                      <Text className="text-gray-400 text-sm">
                        {trip.type === "parking" 
                          ? "Reserved for Parking" 
                          : "Reserved for Parking"}
                      </Text>
                    </View>
                  </View>

                  {/* Status and Bookmark */}
                  <View className="flex-row items-center">
                    <View className="mr-2">
                      <Text className="bg-purple-800 text-gray-100 px-2 py-1 rounded text-xs font-bold">
                        {trip.status}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleReservation(trip)}>
                      <FontAwesome 
                        name={isSaved(tripId) ? "bookmark" : "bookmark-o"} 
                        size={20} 
                        color="white" 
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Reservation Details */}
                <View className="bg-gray-700 rounded-lg p-3 mt-2">
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="calendar" size={16} color="#9333EA" />
                    <Text className="text-gray-200 ml-2">
                      {trip.date}
                    </Text>
                  </View>
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="time" size={16} color="#9333EA" />
                    <Text className="text-gray-200 ml-2">
                      {trip.from_time || trip.startTime} - {trip.to_time || trip.endTime}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="cash" size={16} color="#9333EA" />
                    <Text className="text-white ml-2 font-bold">
                      {trip.price}
                    </Text>
                  </View>
                </View>

                {/* View Details Button - Only show for Active trips */}
                {trip.status === "Active" && (
                  <TouchableOpacity
                    onPress={showComingSoonAlert}
                    className="mt-3 self-start"
                  >
                    <Text className="text-purple-400 text-sm font-semibold">
                      View Details
                    </Text>
                  </TouchableOpacity>
                )}
                
                {/* 
                // Original navigation code (commented out)
                {trip.status === "Active" && (
                  <TouchableOpacity
                    onPress={() => {
                      router.push({
                        pathname: "/(tripDetails)/tripDetails",
                        params: { 
                          tripId: tripId, 
                          totalFee: trip.price,
                          type: trip.type,
                          sessionId: trip.session_id || trip.sessionId
                        },
                      });
                    }}
                    className="mt-3 self-start"
                  >
                    <Text className="text-purple-400 text-sm font-semibold">
                      View Details
                    </Text>
                  </TouchableOpacity>
                )}
                */}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

export default Trips;