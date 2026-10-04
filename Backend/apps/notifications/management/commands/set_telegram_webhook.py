import json
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Sets the Telegram Webhook URL'

    def add_arguments(self, parser):
        parser.add_argument('url', type=str, help='The base URL (e.g., https://your-ngrok.app)')

    def handle(self, *args, **options):
        base_url = options['url'].rstrip('/')
        webhook_url = f"{base_url}/api/v1/notifications/telegram/webhook/"

        token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
        secret = getattr(settings, 'TELEGRAM_WEBHOOK_SECRET', None)

        if not token:
            self.stdout.write(self.style.ERROR("TELEGRAM_BOT_TOKEN is not set in settings/env."))
            return

        api_url = f"https://api.telegram.org/bot{token}/setWebhook"

        data = {'url': webhook_url}
        if secret:
            data['secret_token'] = secret

        encoded_data = urllib.parse.urlencode(data).encode('utf-8')

        try:
            req = urllib.request.Request(api_url, data=encoded_data, method='POST')
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode())
                if result.get('ok'):
                    self.stdout.write(self.style.SUCCESS(f"Successfully set webhook to: {webhook_url}"))
                else:
                    self.stdout.write(self.style.ERROR(f"Failed to set webhook: {result}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error occurred: {e}"))
