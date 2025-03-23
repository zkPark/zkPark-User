import React, { useEffect, useState } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { View, Text, ScrollView, TextInput, Alert, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Region, Circle } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { supabase } from "../supabaseAccess";
import { FontAwesome } from "@expo/vector-icons";

const Explore = () => {
  interface LocationObject {
    coords: {
      latitude: number;
      longitude: number;
    };
  }

  interface ParkingSpot {
    id: string;
    latitude: number;
    longitude: number;
    title: string;
    price: string;
    type: string;
    distance: string;
    availability: string;
    image_url?: string;
  }

  const [location, setLocation] = useState<LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [parkingLoading, setParkingLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg("Permission to access location was denied");
          Alert.alert("Permission Denied", "Please enable location access to use this feature.");
          setLocationLoading(false);
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        setLocation(location);
        setLocationLoading(false);
      } catch (error) {
        console.error("Error getting location:", error);
        setErrorMsg("Failed to get location");
        setLocationLoading(false);
      }
    })();
  }, []);

  const formatAddress = (address: string) => {
    if (!address) return "Unknown location";
    
    const parts = address.split(/,|\s+/);
    
    if (parts.length > 1 && /^\d+$/.test(parts[0])) {
      parts.shift();
    }
    
    return parts.join(" ").trim();
  };

  const calculateFakeDistance = () => {
    const distances = ["0.3 miles away", "0.5 miles away", "0.7 miles away", 
                       "0.4 miles away", "0.8 miles away", "1.2 miles away"];
    return distances[Math.floor(Math.random() * distances.length)];
  };

  useEffect(() => {
    const fetchParkingSpots = async () => {
      try {
        const { data, error } = await supabase
          .from('parking')
          .select('*');

        if (error) {
          throw error;
        }

        if (data) {
          const formattedSpots = data.map((spot, index) => ({
            id: spot.id || `p${index + 1}`,
            latitude: parseFloat(spot.lat) || 38.8816,  
            longitude: parseFloat(spot.long) || -77.0910,  
            title: formatAddress(spot.addr || ''),
            price: "$4/hr", 
            type: "parking",
            distance: calculateFakeDistance(),
            availability: ["Available now", "2 spots left", "5 spots left", "3 spots left"][Math.floor(Math.random() * 4)],
            image_url: spot.purl1 || null
          }));

          setParkingSpots(formattedSpots);
        }
      } catch (error) {
        console.error("Error fetching parking spots:", error);
        // Fallback to default coordinates if there's an error
        setParkingSpots([
          {
            id: "p1",
            latitude: 38.8816,
            longitude: -77.0910,
            title: "Ballston Area",
            price: "$5/hr",
            type: "parking",
            distance: "0.3 miles away",
            availability: "Available now"
          }
        ]);
      } finally {
        setParkingLoading(false);
      }
    };

    fetchParkingSpots();
  }, []);
  
  const handleReservePress = (station: ParkingSpot) => {
    router.push({
      pathname: "/reserve",
      params: { station: JSON.stringify(station) },
    });
  };
  
  // Updated marker for parking spots with stable circle size
  const renderParkingMarker = (spot: ParkingSpot) => {
    return (
      <React.Fragment key={spot.id}>
        {/* Outer transparent circle that maintains size on zoom */}
        <Circle
          center={{ latitude: spot.latitude, longitude: spot.longitude }}
          radius={100} // Radius in meters, will stay consistent on zoom
          fillColor="rgba(107, 33, 168, 0.2)" // Purple with 20% opacity
          strokeWidth={5}
          strokeColor="#1d0430"
        />
        
        {/* Inner P marker */}
        <Marker
          coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
          title={spot.title}
          description="Tap to reserve a spot"
          onPress={() => handleReservePress(spot)}
        >
          <View className="bg-purple-800 rounded-full border-2 border-white w-10 h-10 justify-center items-center">
            <Text className="text-white font-bold text-lg">P</Text>
          </View>
        </Marker>
      </React.Fragment>
    );
  };

  const isLoading = locationLoading || parkingLoading;

  if (errorMsg) {
    return (
      <SafeAreaView className="bg-primary flex-1 justify-center items-center">
        <Text className="text-white text-lg">{errorMsg}</Text>
      </SafeAreaView>
    );
  }

  if (isLoading || !location) {
    return (
      <SafeAreaView className="bg-primary flex-1 justify-center items-center">
        <Text className="text-white text-lg">Loading...</Text>
      </SafeAreaView>
    );
  }

  // Set the initial map region based on first parking spot or default to Arlington, VA
  const initialRegion = parkingSpots.length > 0 
    ? {
        latitude: parkingSpots[0].latitude,
        longitude: parkingSpots[0].longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }
    : {
        latitude: 38.8816,
        longitude: -77.0910,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

  return (
    <View className="bg-primary h-full">
      <View className="flex flex-row justify-between items-center mt-16 px-4">
        <View className="flex flex-row items-center mt-6">
        <FontAwesome name="car" size={28} color="#6B21A8" />
        <Text className="text-3xl ml-3 font-bold text-white">ZKpark</Text>
        </View>
        {/* Removed 0G upload button */}
        <MaterialIcons name="notifications-none" size={30} color="white" />
      </View>

      {/* Search Bar */}
      <View className="border-2 gap-4 mt-4 border-black-200 mx-3 h-14 px-4 rounded-2xl items-center flex flex-row">
        <Ionicons name="search" size={16} color="white" />
        <TextInput className="text-base text-white flex-1" placeholder="Search for parking spots" placeholderTextColor="#A0A0A0" />
      </View>

      {/* Map Section */}
      <View className="flex-1 mt-2">
        <MapView
          style={{ flex: 1, width: "100%", height: "100%" }}
          initialRegion={initialRegion}
        >
          {/* User's Current Location Marker */}
          <Marker 
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            }}
            pinColor="yellow" 
          />

          {/* Parking Spot Markers with custom 'P' icon and stable circles */}
          {parkingSpots.map(spot => renderParkingMarker(spot))}
        </MapView>
        
        {/* Horizontal Listing */}
        <View className="absolute bottom-4 left-0 right-0">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
            {parkingSpots.map((spot) => (
              <TouchableOpacity
                key={spot.id}
                onPress={() => handleReservePress(spot)}
                className="bg-gray-800 p-4 rounded-lg mr-4 w-80 h-44 shadow-lg"
              >
                <View className="flex flex-col justify-between h-full">
                  <View className="mb-1">
                    <View className="flex flex-row justify-between items-start">
                      <View className="flex-1 mr-2">
                        <Text 
                          className="text-white text-lg font-bold" 
                          numberOfLines={2} 
                          ellipsizeMode="tail"
                        >
                          {spot.title}
                        </Text>
                      </View>
                      <View>
                        <Text className="bg-purple-800 text-gray-100 px-2 py-1 rounded text-sm font-bold">
                          {spot.price}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-gray-400 mt-1">{spot.distance}</Text>
                  </View>
                  
                  <View className="border-t border-gray-700 my-2" />
                  
                  <View className="flex-row items-center justify-between">
                    {spot.image_url ? (
                      <Image 
                        source={{ uri: spot.image_url }} 
                        className="w-12 h-12 rounded-md"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="bg-purple-800 rounded-full w-12 h-12 justify-center items-center">
                        <Text className="text-white font-bold text-lg">P</Text>
                      </View>
                    )}
                    
                    <View className="flex-1 ml-3">
                      <Text className="text-purple-600 font-semibold">Parking Available</Text>
                      <Text className="text-gray-100 text-xs">{spot.availability}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

export default Explore;