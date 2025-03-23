import React, { createContext, useState, useContext, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Reservation = {
  parking_transaction_id: string;
  title: string;
  date: string;
  from_time: string;
  to_time: string;
  price: string;
  status: "Active" | "Completed";
  parking_id: string;
};

type SavedReservationsContextType = {
  savedReservations: Reservation[];
  addSavedReservation: (reservation: Reservation) => Promise<void>;
  removeSavedReservation: (reservationId: string) => Promise<void>;
  isSaved: (reservationId: string) => boolean;
};

const SavedReservationsContext = createContext<
  SavedReservationsContextType | undefined
>(undefined);

export const SavedReservationsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [savedReservations, setSavedReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    loadSavedReservations();
  }, []);

  const loadSavedReservations = async () => {
    try {
      const savedData = await AsyncStorage.getItem("savedReservations");
      if (savedData) {
        setSavedReservations(JSON.parse(savedData));
      }
    } catch (error) {
      console.error("Error loading saved reservations:", error);
    }
  };

  const addSavedReservation = async (reservation: Reservation) => {
    try {
      const isAlreadySaved = savedReservations.some(
        (saved) =>
          saved.parking_transaction_id === reservation.parking_transaction_id
      );

      if (!isAlreadySaved) {
        const updatedSavedReservations = [...savedReservations, reservation];

        await AsyncStorage.setItem(
          "savedReservations",
          JSON.stringify(updatedSavedReservations)
        );

        setSavedReservations(updatedSavedReservations);
      }
    } catch (error) {
      console.error("Error saving reservation:", error);
    }
  };

  const removeSavedReservation = async (reservationId: string) => {
    try {
      const updatedSavedReservations = savedReservations.filter(
        (res) => res.parking_transaction_id !== reservationId
      );

      await AsyncStorage.setItem(
        "savedReservations",
        JSON.stringify(updatedSavedReservations)
      );

      setSavedReservations(updatedSavedReservations);
    } catch (error) {
      console.error("Error removing saved reservation:", error);
    }
  };

  const isSaved = (reservationId: string) => {
    return savedReservations.some(
      (saved) => saved.parking_transaction_id === reservationId
    );
  };

  return (
    <SavedReservationsContext.Provider
      value={{
        savedReservations,
        addSavedReservation,
        removeSavedReservation,
        isSaved,
      }}
    >
      {children}
    </SavedReservationsContext.Provider>
  );
};

export const useSavedReservations = () => {
  const context = useContext(SavedReservationsContext);
  if (context === undefined) {
    throw new Error(
      "useSavedReservations must be used within a SavedReservationsProvider"
    );
  }
  return context;
};
