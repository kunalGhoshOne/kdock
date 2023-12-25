const ip = require('ip');

// Input the subnet
const subnet = '10.6.4.0/16';

// Calculate subnet details
const subnetDetails = ip.cidrSubnet(subnet);

// Generate and display the list of IP addresses
const ipList = [];
for (let i = ip.toLong(subnetDetails.firstAddress); i <= ip.toLong(subnetDetails.lastAddress); i++) {
    ipList.push(ip.fromLong(i));
}

// it will check all docker containers and get the address of containers then get the list of address
// available and reserved it also responsible for assigning address to each containers
// it will provide address when a container going to deploy
