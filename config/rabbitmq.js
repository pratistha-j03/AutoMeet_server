import amqp from 'amqplib';

let connection = null;
let channel = null;

export async function getRabbitChannel() {
    if (channel) return channel;

    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // Main queue — survives broker restart
    await channel.assertQueue('meeting_processing', {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'dlx',           // failed jobs 
            'x-dead-letter-routing-key': 'meeting_failed'
        }
    });

    // Dead letter exchange + queue for permanently failed jobs
    await channel.assertExchange('dlx', 'direct', { durable: true });
    await channel.assertQueue('meeting_processing_failed', { durable: true });
    await channel.bindQueue('meeting_processing_failed', 'dlx', 'meeting_failed');

    console.log('[RabbitMQ] Channel ready.');
    return channel;
}

export async function closeRabbitConnection() {
    if (channel) await channel.close();
    if (connection) await connection.close();
    channel = null;
    connection = null;
}