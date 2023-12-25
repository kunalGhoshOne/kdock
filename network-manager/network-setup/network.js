const Shell = require("shelljs");
const fs = require("fs");
const TYPE_NODE = process.env.SERVER_TYPE;
const CURRENT_HOST_ADDR = process.env.HOST_IP_ADDRESS;
const SERVER_ADDR = process.env.SERVER_ADDRESS
const CURRENT_HOST_NETWORK = process.env.CURRENT_HOST_ADDRESS;
function change_dockerservice_config(){
    var data = fs.readFileSync("/lib/systemd/system/docker.service");
    if(data){
        var lines = data.split('\n');
        var searchString = "ExecStart=";
        var replacementString="ExecStart=/usr/bin/docker daemon $DOCKER_OPTS -H fd://";
        // Find the line that contains the search string and replace it
        var modifiedLines = lines.map(line => (line.includes(searchString) ? replacementString : line));

        // Join the lines back into a string
        var modifiedContent = modifiedLines.join('\n');
        var datanow = fs.writeFileSync("/lib/systemd/system/docker.service",modifiedContent);
        return datanow;
    }
}

function deploy_consul_server(){
    var dockerconsul="docker run -d -p 8500:8500 -h consul --name consul progrium/consul -server -bootstrap";
    var { deploy_consul_server_stdout, 
        deploy_consul_server_stderr, 
        deploy_consul_server_code } = Shell.exec(dockerconsul);
    if(deploy_consul_server_stdout){
        return {status:true,message:deploy_consul_server_stdout};
    }else{
        return {status:false,message:deploy_consul_server_stderr};
    }
}

function setup_server_network(){

    var consuldata=deploy_consul_server();
    if(consuldata.status == true){
        var stopdocker=Shell.exec("service docker status &");
        if(stopdocker.stderr.length < 1 && file_mode == true){
            var dockerfiledata=fs.readFileSync("/etc/default/docker",{ encoding: 'utf8', flag: 'r' });
            dockerfiledata.replace("DOCKER_OPTS=","#DOCKER_OPTS=");
            var dockerfile_stop_old=fs.writeFileSync("/etc/default/docker",dockerfiledata);
            var new_docker_opt_data = 'DOCKER_OPTS="-H tcp://0.0.0.0:2375 -H unix:///var/run/docker.sock --cluster-advertise '+CURRENT_HOST_NETWORK+':2375 --cluster-store consul://'+CURRENT_HOST_ADDR+':8500"';
            var addconfdocker = fs.appendFileSync("/etc/default/docker","\n"+new_docker_opt_data);
            if(addconfdocker){
                var restartdocker=Shell.exec("service docker restart");
                if(restartdocker.stderr < 1){
                    var confgdockerservce = change_dockerservice_config();
                    if(confgdockerservce.length != 0){
                        var daemonreload = Shell.exec("systemctl daemon-reload && service docker restart");
                        if(daemonreload.stderr.length < 1){
                            var checkdockerconfiginfo=Shell.exec("docker info");
                            return {status:true,message:checkdockerconfiginfo.stdout};
                        }
                    }
                    
                }
            }
        }else if(stopdocker.stderr.length < 1){
            var command = "dockerd -H tcp://0.0.0.0:2375 -H unix:///var/run/docker.sock --cluster-advertise ";
            command = command+""+CURRENT_HOST_NETWORK+":2375 --cluster-store consul://"+CURRENT_HOST_ADDR+":8500 &";
            var execdocker = Shell.exec(command);
            if(execdocker.stderr.length < 1){
                var restartdocker=Shell.exec("service docker restart");
                if(restartdocker.stderr < 1){
                    var daemonreload = Shell.exec("systemctl daemon-reload && service docker restart");
                    if(daemonreload.stderr.length < 1){
                        var checkdockerconfiginfo=Shell.exec("docker info");
                        return {status:true,message:checkdockerconfiginfo.stdout};
                    }
                }
            }
        }
    }

}

function setup_client_network(){
    var  connect_to_server=connect_client_to_server_consul();
    if(connect_to_server.status == true){
        create_overlay_network();
    }
}

function create_overlay_network(){
    var checknetwork = Shell.exec("docker network inspect kdock-network");
    if(checknetwork.code == 0){
        return {status:true,message:"docker network exists"};
    }else{
        var command="docker network create -d overlay — subnet=10.42.0.0/16 kdock-network";
        var create_network = Shell.exec(command);
        if(create_network.stderr.length > 1 && create_network.code == 0){
            return {status:true,message:"docker network created"};
        }
    }
    
}


function connect_client_to_server_consul(){
    var stopdocker = Shell.exec("systemctl stop docker");
    if(stopdocker.stderr.length > 1){
        var command ="dockerd -H tcp://0.0.0.0:2375 -H unix:///var/run/docker.sock ";
        command = command+"--cluster-advertise "+CURRENT_HOST_NETWORK+":2375 ";
        command = command+"--cluster-store consul://"+SERVER_ADDR+":8500 &";
        var commadexec=Shell.exec(command);
        if(commadexec.stderr.length < 0){
            Shell.exec("systemctl start docker");
            return {status:true,message:"connect client to server consul"};
        }
    }
    
}
function network_manage(){

    if(TYPE_NODE == "server"){
        setup_server_network();
    }else if(TYPE_NODE == "node"){
        setup_client_network();
    }else{
        var warning="YOU HAVE TO SET \"SERVER_TYPE\" TO EITHER \"server\" OR \"node\"";
        console.error(warning);
    }


}

function main(){
    setInterval(network_manage(), 10000);
}

main();