import os
import re

def main():
    file_path = "server.py"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # The block we want to replace
    target_block = """        paytm_body = {
            "requestType": "Payment",
            "mid": PAYTM_MID,
            "websiteName": PAYTM_WEBSITE,
            "orderId": order_id,
            "callbackUrl": PAYTM_CALLBACK_URL,
            "txnAmount": {"value": amount_str, "currency": "INR"},
            "userInfo": {"custId": user_id}
        }

        # Generate checksum using exact dump format recommended
        checksum = paytmchecksum.generateSignature(
            json.dumps(paytm_body), PAYTM_MERCHANT_KEY
        )

        payload = {
            "body": paytm_body,
            "head": {"signature": checksum}
        }

        url = f"https://{PAYTM_HOST}/theia/api/v1/initiateTransaction?mid={PAYTM_MID}&orderId={order_id}"

        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, json=payload)
            result = resp.json()"""

    new_block = """        paytm_body = {
            "requestType": "Payment",
            "mid": PAYTM_MID,
            "websiteName": PAYTM_WEBSITE,
            "orderId": order_id,
            "callbackUrl": PAYTM_CALLBACK_URL,
            "txnAmount": {"value": amount_str, "currency": "INR"},
            "userInfo": {"custId": user_id}
        }

        if PAYTMPG_SDK_AVAILABLE:
            from paytmpg.merchant.models.PaymentDetail import PaymentDetailBuilder
            from paytmpg.merchant.models.UserInfo import UserInfo
            from paytmpg.merchant.models.Money import Money
            from paytmpg.pg.Payment import Payment
            
            amount = Money(amount_str, "INR")
            user_info = UserInfo(user_id)
            payment_detail = PaymentDetailBuilder("WEB", order_id, amount, user_info).build()
            response = Payment.createTxnToken(payment_detail)
            
            if response.get_response_object() and response.get_response_object().get_body():
                body = response.get_response_object().get_body()
                if body.get_result_info() and body.get_result_info().get_result_status() == "S":
                    txn_token = body.get_txn_token()
                    result = {
                        "body": {
                            "txnToken": txn_token,
                            "resultInfo": {
                                "resultStatus": "S",
                                "resultCode": body.get_result_info().get_result_code()
                            }
                        }
                    }
                    print("✅ Paytm SDK txnToken generated successfully:", txn_token)
                else:
                    result = {
                        "body": {
                            "resultInfo": {
                                "resultStatus": "F",
                                "resultCode": body.get_result_info().get_result_code() if body.get_result_info() else "UNKNOWN",
                                "resultMsg": body.get_result_info().get_result_msg() if body.get_result_info() else "UNKNOWN"
                            }
                        }
                    }
            else:
                result = {"body": {}}
        else:
            import json
            # Generate checksum using exact dump format recommended (no spaces)
            checksum = paytmchecksum.generateSignature(
                json.dumps(paytm_body, separators=(',', ':')), PAYTM_MERCHANT_KEY
            )
    
            payload = {
                "body": paytm_body,
                "head": {"signature": checksum}
            }
    
            url = f"https://{PAYTM_HOST}/theia/api/v1/initiateTransaction?mid={PAYTM_MID}&orderId={order_id}"
    
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(url, json=payload)
                result = resp.json()"""

    if target_block in content:
        content = content.replace(target_block, new_block)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated initiate_paytm in server.py")
    else:
        print("Could not find the target block to replace.")

if __name__ == "__main__":
    main()
