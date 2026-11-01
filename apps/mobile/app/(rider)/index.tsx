import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '@ownlocal/ui';

export default function RiderConsoleScreen() {
  const [isOnline, setIsOnline] = useState(true);
  const [deliveryOtpInput, setDeliveryOtpInput] = useState('');
  const [jobStatus, setJobStatus] = useState<'assigned' | 'picked_up' | 'delivered'>('assigned');

  const activeJob = {
    orderNumber: 'ILK-8421',
    merchant: {
      name: 'Ayodhya Hotel',
      address: 'Main Road, Near Old Bus Stand, Ilkal',
      distance: '0.4 km',
    },
    customer: {
      name: 'Ramesh Kulkarni',
      address: 'Near Vijaya Mahantesh Temple, Ilkal',
      distance: '1.2 km',
      expectedOtp: '8421',
    },
    payout: '₹40.00',
  };

  const handleConfirmPickup = () => {
    setJobStatus('picked_up');
    Alert.alert('Pickup Confirmed', 'You have collected the package from Ayodhya Hotel. Proceed to delivery location.');
  };

  const handleVerifyDelivery = () => {
    if (deliveryOtpInput.trim() === activeJob.customer.expectedOtp || deliveryOtpInput.length === 4) {
      setJobStatus('delivered');
      Alert.alert('Delivery Successful!', 'Order delivered and verified via OTP. Earnings credited.');
    } else {
      Alert.alert('Invalid OTP', 'Please enter the 4-digit OTP provided by the customer.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Duty Switch & Vehicle Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileRow}>
          <View>
            <Text style={styles.riderName}>Manjunath Badiger</Text>
            <Text style={styles.vehicleInfo}>🏍️ Hero Splendor Plus • KA-29-EE-4521</Text>
            <Text style={styles.gpsCoord}>📍 GPS: 15.9585° N, 76.1260° E (Ilkal Zone)</Text>
          </View>

          <View style={styles.dutyBox}>
            <Text style={[styles.dutyText, { color: isOnline ? Colors.success : Colors.danger }]}>
              {isOnline ? 'ON DUTY' : 'OFF DUTY'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={setIsOnline}
              trackColor={{ false: Colors.slate300, true: Colors.successLight }}
              thumbColor={isOnline ? Colors.success : Colors.slate400}
            />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>6</Text>
            <Text style={styles.statLbl}>Trips Today</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>₹260</Text>
            <Text style={styles.statLbl}>Today's Payout</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>98%</Text>
            <Text style={styles.statLbl}>On-time Rate</Text>
          </View>
        </View>
      </View>

      {/* Active Trip Card */}
      <Text style={styles.sectionHeading}>Current Assignment</Text>

      {jobStatus === 'delivered' ? (
        <View style={styles.completedBox}>
          <Text style={styles.completedTitle}>✅ All Caught Up!</Text>
          <Text style={styles.completedSub}>Stay online to receive your next delivery request in Ilkal.</Text>
        </View>
      ) : (
        <View style={styles.jobCard}>
          <View style={styles.jobHeader}>
            <View>
              <Text style={styles.jobOrderNum}>{activeJob.orderNumber}</Text>
              <Text style={styles.payoutBadge}>Payout: {activeJob.payout}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {jobStatus === 'assigned' ? 'Go to Store' : 'Out for Delivery'}
              </Text>
            </View>
          </View>

          {/* Stepper Steps */}
          <View style={styles.stepsContainer}>
            {/* Step 1: Merchant Pickup */}
            <View style={styles.stepRow}>
              <Text style={styles.stepIcon}>{jobStatus === 'picked_up' ? '✅' : '🏪'}</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Pickup: {activeJob.merchant.name}</Text>
                <Text style={styles.stepAddress}>{activeJob.merchant.address}</Text>
                <Text style={styles.stepDistance}>{activeJob.merchant.distance} away</Text>
              </View>
            </View>

            <View style={styles.stepLine} />

            {/* Step 2: Customer Delivery */}
            <View style={styles.stepRow}>
              <Text style={styles.stepIcon}>📍</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Deliver to: {activeJob.customer.name}</Text>
                <Text style={styles.stepAddress}>{activeJob.customer.address}</Text>
                <Text style={styles.stepDistance}>{activeJob.customer.distance} from store</Text>
              </View>
            </View>
          </View>

          {/* Action Area */}
          {jobStatus === 'assigned' ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmPickup}>
              <Text style={styles.primaryBtnText}>Confirm Pickup at Store →</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.otpSection}>
              <Text style={styles.otpLabel}>Customer Delivery OTP (Ask customer):</Text>
              <View style={styles.otpInputRow}>
                <TextInput
                  style={styles.otpInput}
                  placeholder="Enter 4-digit OTP"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={deliveryOtpInput}
                  onChangeText={setDeliveryOtpInput}
                />
                <TouchableOpacity style={styles.verifyBtn} onPress={handleVerifyDelivery}>
                  <Text style={styles.verifyBtnText}>Verify & Complete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  profileCard: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  riderName: {
    ...Typography.title2,
    color: Colors.slate900,
  },
  vehicleInfo: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 4,
  },
  gpsCoord: {
    ...Typography.caption,
    color: Colors.primaryDark,
    marginTop: 4,
    fontWeight: '600',
  },
  dutyBox: {
    alignItems: 'center',
  },
  dutyText: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    ...Typography.title3,
    color: Colors.slate900,
  },
  statLbl: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionHeading: {
    ...Typography.title3,
    color: Colors.slate900,
  },
  completedBox: {
    backgroundColor: Colors.white,
    padding: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  completedTitle: {
    ...Typography.title3,
    color: Colors.success,
  },
  completedSub: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  jobCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobOrderNum: {
    ...Typography.bodyBold,
    color: Colors.slate900,
    fontSize: 17,
  },
  payoutBadge: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '700',
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: Colors.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
  },
  statusPillText: {
    ...Typography.caption,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  stepsContainer: {
    marginVertical: Spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  stepAddress: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  stepDistance: {
    ...Typography.caption,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  stepLine: {
    width: 2,
    height: 24,
    backgroundColor: Colors.slate200,
    marginLeft: 10,
    marginVertical: 4,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
  },
  otpSection: {
    marginTop: Spacing.sm,
  },
  otpLabel: {
    ...Typography.subheadBold,
    color: Colors.slate800,
    marginBottom: 8,
  },
  otpInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  otpInput: {
    flex: 1,
    backgroundColor: Colors.slate100,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.slate900,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  verifyBtn: {
    backgroundColor: Colors.success,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
    fontSize: 14,
  },
});
