import { OrderStatus } from '@ownlocal/types';
import { Colors } from './theme';

export * from './theme';

export function getOrderStatusConfig(status: OrderStatus): { label: string; bg: string; text: string } {
  switch (status) {
    case 'CREATED':
    case 'MERCHANT_CONFIRMATION_PENDING':
      return { label: 'Awaiting Merchant', bg: Colors.warningLight, text: Colors.warning };
    case 'MERCHANT_CONFIRMED':
    case 'PREPARING':
      return { label: 'Preparing', bg: Colors.infoLight, text: Colors.info };
    case 'RIDER_ASSIGNMENT_PENDING':
    case 'RIDER_ASSIGNED':
      return { label: 'Rider Assigned', bg: Colors.infoLight, text: Colors.info };
    case 'READY_FOR_PICKUP':
      return { label: 'Ready for Pickup', bg: Colors.secondaryTint, text: Colors.secondaryDark };
    case 'PICKED_UP':
    case 'OUT_FOR_DELIVERY':
      return { label: 'Out for Delivery', bg: Colors.primaryTint, text: Colors.primaryDark };
    case 'DELIVERED':
      return { label: 'Delivered', bg: Colors.successLight, text: Colors.success };
    case 'MERCHANT_REJECTED':
    case 'CUSTOMER_CANCELLED':
    case 'RIDER_CANCELLED':
    case 'FAILED':
      return { label: 'Cancelled', bg: Colors.dangerLight, text: Colors.danger };
    case 'PAYMENT_PENDING':
      return { label: 'Payment Pending', bg: Colors.warningLight, text: Colors.warning };
    case 'REFUND_PENDING':
    case 'REFUNDED':
      return { label: 'Refunded', bg: Colors.slate100, text: Colors.slate600 };
    default:
      return { label: status, bg: Colors.slate100, text: Colors.slate600 };
  }
}
