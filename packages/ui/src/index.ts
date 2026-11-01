import { OrderStatus } from '@ownlocal/types';
import { Colors } from './theme';

export * from './theme';

export function getOrderStatusConfig(status: OrderStatus | string): { label: string; bg: string; text: string } {
  switch (status) {
    case 'CREATED':
    case 'MERCHANT_CONFIRMATION_PENDING':
      return { label: 'Awaiting Store Confirmation ⏳', bg: '#fef3c7', text: '#b45309' };
    case 'MERCHANT_CONFIRMED':
      return { label: 'Store Confirmed 🎉', bg: '#eaf8f2', text: '#08774c' };
    case 'PREPARING':
      return { label: 'Kitchen Preparing 🍳', bg: '#fff0da', text: '#a55a00' };
    case 'RIDER_ASSIGNMENT_PENDING':
      return { label: 'Finding Nearby Rider 🔍', bg: Colors.infoLight, text: Colors.info };
    case 'RIDER_ASSIGNED':
      return { label: 'Rider Assigned 🛵', bg: Colors.infoLight, text: Colors.info };
    case 'READY_FOR_PICKUP':
      return { label: 'Ready for Pickup 🛍️', bg: Colors.secondaryTint, text: Colors.secondaryDark };
    case 'PICKED_UP':
      return { label: 'Picked Up by Rider 🛵', bg: Colors.primaryTint, text: Colors.primaryDark };
    case 'OUT_FOR_DELIVERY':
      return { label: 'Out for Delivery 🚀', bg: Colors.primaryTint, text: Colors.primaryDark };
    case 'DELIVERED':
      return { label: 'Delivered Successfully ✓', bg: Colors.successLight, text: Colors.success };
    case 'MERCHANT_REJECTED':
      return { label: 'Declined by Store', bg: Colors.dangerLight, text: Colors.danger };
    case 'CUSTOMER_CANCELLED':
      return { label: 'Cancelled by Customer', bg: Colors.dangerLight, text: Colors.danger };
    case 'RIDER_CANCELLED':
      return { label: 'Rider Reassigned', bg: Colors.warningLight, text: Colors.warning };
    case 'FAILED':
      return { label: 'Order Failed', bg: Colors.dangerLight, text: Colors.danger };
    case 'PAYMENT_PENDING':
      return { label: 'Payment Pending', bg: Colors.warningLight, text: Colors.warning };
    case 'PAYMENT_CONFIRMED':
      return { label: 'Payment Received ✓', bg: Colors.successLight, text: Colors.success };
    case 'REFUND_PENDING':
      return { label: 'Refund Initiated', bg: Colors.infoLight, text: Colors.info };
    case 'REFUNDED':
      return { label: 'Refund Completed', bg: Colors.slate100, text: Colors.slate600 };
    default: {
      const cleanLabel = String(status || '')
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return { label: cleanLabel || 'Processing', bg: Colors.slate100, text: Colors.slate600 };
    }
  }
}
